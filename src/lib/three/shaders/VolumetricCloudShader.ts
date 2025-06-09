
import * as THREE from 'three';

const VolumetricCloudShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2() }, 
    uCloudColor: { value: new THREE.Color(0x607080) }, 
    uSkyColor: { value: new THREE.Color(0x05080F) },   // This can be default base color for cloud internals or atmosphere
    uDensityFactor: { value: 0.06 }, // Reduced from 0.1
    uCoverFactor: { value: 0.6 },  
    uNoiseScale: { value: 2.8 },
    uSeed: { value: 0.3 },       
    uCloudSpeed: { value: 0.025 }, 
    uCloudLayers: { value: 3 },   
    uLayerStep: { value: 0.25 },   
    uGlowFactor: { value: 0.15 } 
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec3 uCloudColor;
    // uSkyColor is available but not used for final background mix if scene.background is an HDRI
    // uniform vec3 uSkyColor; 
    uniform float uDensityFactor;
    uniform float uCoverFactor; 
    uniform float uNoiseScale;
    uniform float uSeed;
    uniform float uCloudSpeed;
    uniform int uCloudLayers;
    uniform float uLayerStep;
    uniform float uGlowFactor;

    varying vec2 vUv;

    // Ashima Arts 2D Simplex Noise
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec2 mod289(vec2 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec3 permute(vec3 x) {
      return mod289(((x*34.0)+1.0)*x);
    }

    float snoise(vec2 v)
      {
      const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                          0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                         -0.577350269189626,  // -1.0 + 2.0 * C.x
                          0.024390243902439); // 1.0 / 41.0
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);

      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec2 x1 = x0 - i1 + C.xx;
      vec2 x2 = x0 + C.zz; 

      i = mod289(i);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));

      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
      m = m*m ;
      m = m*m ;

      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;

      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * vec2(x1.x,x2.x) + h.yz * vec2(x1.y,x2.y); 
      return 130.0 * dot(m, g);
    }
    // End Ashima Arts 2D Simplex Noise

    float fbm(vec2 st, float timeOffset, float H, int octaves) {
        float G = exp2(-H); 
        float f = 1.0;      
        float a = 1.0;      
        float t = 0.0;      
        for (int i = 0; i < octaves; i++) {
            t += a * snoise(f * st + timeOffset * 0.5 + uSeed * 5.0); 
            f *= 2.0; 
            a *= G;   
        }
        return t;
    }

    void main() {
      vec2 uv = vUv;
      vec2 centeredUv = (uv - 0.5) * 2.0; 
      if (uResolution.x > uResolution.y) {
        centeredUv.x *= uResolution.x / uResolution.y;
      } else {
        centeredUv.y *= uResolution.y / uResolution.x;
      }

      float mainShapeMask = 1.0 - smoothstep(uCoverFactor * 0.8, uCoverFactor * 1.2, length(centeredUv * vec2(1.0, 0.65)));

      if (mainShapeMask < 0.001) {
        discard;
      }
      
      float timeVal = uTime * uCloudSpeed;
      float noiseVal = 0.0;
      float layerContributionSum = 0.0;

      for(int i = 0; i < uCloudLayers; i++) {
          float layerDepthFactor = float(i) / float(max(1, uCloudLayers -1));
          float layerScale = uNoiseScale * (1.0 + layerDepthFactor * 0.5);
          float layerTime = timeVal * (1.0 - layerDepthFactor * 0.3);
          float layerOffset = uSeed + float(i) * uLayerStep;
          
          float currentNoise = (fbm(uv * layerScale + layerOffset, layerTime, 0.5, 4) + 1.0) * 0.5;
          
          float layerWeight = pow(1.0 - layerDepthFactor, 1.5);
          noiseVal += currentNoise * layerWeight;
          layerContributionSum += layerWeight;
      }
      if (layerContributionSum > 0.0) {
        noiseVal /= layerContributionSum;
      }
      
      float finalNoise = noiseVal * mainShapeMask;
      float alpha = smoothstep(0.45, 0.65, finalNoise) * uDensityFactor * mainShapeMask;
      alpha = clamp(alpha, 0.0, 1.0);

      if (alpha < 0.01) {
          discard;
      }

      // Determine cloud's own color
      vec3 cloudBaseColor = uCloudColor; // Use the uCloudColor uniform for the cloud's body
      vec3 shadedCloudColor = cloudBaseColor + uGlowFactor * cloudBaseColor * alpha; // Add glow based on its own alpha
      
      // Apply a simple lighting model to the cloud itself
      float lightFactor = 1.0 - abs(centeredUv.y) * 0.15 + 0.1; 
      shadedCloudColor *= lightFactor;
      
      // Output the cloud's color and its calculated alpha.
      // The GPU will blend this with scene.background (HDRI or solid color)
      gl_FragColor = vec4(shadedCloudColor, alpha);
    }
  `
};

export { VolumetricCloudShader };
