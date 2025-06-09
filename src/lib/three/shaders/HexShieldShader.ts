
import * as THREE from 'three';

const HexShieldShader = {
  uniforms: {
    uTime: { value: 0.0 },
    uColor: { value: new THREE.Color(0x48BFE3) }, 
    uGlowColor: { value: new THREE.Color(0x80FFFF) }, 
    uHexSize: { value: 0.3 }, 
    uBorderThickness: { value: 0.15 }, 
    uFresnelPower: { value: 3.0 },
    uBaseOpacity: { value: 0.3 },
    uPulseSpeed: { value: 5.5 },
    uPulseAmount: { value: 0.4 }, 
    uHitEffectTime: { value: 0.1 }, 
    uEnvMap: { value: null as THREE.Texture | null },
    uReflectivity: { value: 0.65 },
    uSurfaceDistortionAmount: { value: 0.08 },
    uSurfaceDistortionSpeed: { value: 0.5 },
    uRotationSpeed: { value: 0.5 }, // Added for UV rotation
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDirection;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vReflect;

    void main() {
      vUv = uv;
      vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos4.xyz;
      
      vec3 worldNormal = normalize(mat3(modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz) * normal);
      vNormal = worldNormal;
      
      vViewDirection = normalize(cameraPosition - vWorldPosition);
      
      vec3 incident = normalize(vWorldPosition - cameraPosition);
      vReflect = reflect(incident, worldNormal);

      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uGlowColor;
    uniform float uHexSize; 
    uniform float uBorderThickness; 
    uniform float uFresnelPower;
    uniform float uBaseOpacity;
    uniform float uPulseSpeed;
    uniform float uPulseAmount;
    uniform float uHitEffectTime;
    uniform sampler2D uEnvMap;
    uniform float uReflectivity;
    uniform float uSurfaceDistortionAmount;
    uniform float uSurfaceDistortionSpeed;
    uniform float uRotationSpeed; // Added

    varying vec3 vNormal;
    varying vec3 vViewDirection;
    varying vec2 vUv; // Original UV from vertex shader
    varying vec3 vWorldPosition;
    varying vec3 vReflect;

    float noise(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float getHexLineDist(vec2 uv_in, float hex_size_inv_scale) {
        vec2 p = uv_in * hex_size_inv_scale; 
        p.x *= 0.866025; 
      
        float r3 = 0.57735; 
        
        float x = p.x;
        float y = p.y / 3.0; 

        float hx = fract(x + 0.5); 
        float hy = fract(y + 0.5);

        float f = abs((hy-0.5)*r3 - (hx-0.5)); 
        float g = abs((hy-0.5)*r3 + (hx-0.5)); 
        float m = abs(hx-0.5);                 
        
        return min(min(f,g),m); 
    }

    mat2 rotate2D(float angle) {
        return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    }

    void main() {
      // UV Rotation
      vec2 centeredOriginalUv = vUv - vec2(0.5);
      float rotationAngle = uTime * uRotationSpeed;
      mat2 rotationMatrix = rotate2D(rotationAngle);
      vec2 rotatedUvInput = rotationMatrix * centeredOriginalUv + vec2(0.5);

      // Surface Distortion using rotated UVs
      float distortionTime = uTime * uSurfaceDistortionSpeed;
      vec2 distortionOffset = vec2(
        noise(rotatedUvInput * 5.0 + distortionTime) - 0.5,
        noise(rotatedUvInput * 5.0 + distortionTime + 10.0) - 0.5
      ) * uSurfaceDistortionAmount;
      vec2 distortedUv = rotatedUvInput + distortionOffset; // Final UV for hex pattern

      // Hexagon Pattern using distorted (and rotated) UVs
      float hexDensityScale = 1.0 / uHexSize; 
      float distToEdge = getHexLineDist(distortedUv, hexDensityScale);
      float lineRegion = 1.0 - smoothstep(0.0, uBorderThickness, distToEdge);
      
      // Pulse effect
      float timeAndPosPhase = uTime * uPulseSpeed + vWorldPosition.x * 0.8 + vWorldPosition.y * 0.6;
      float pulse = (sin(timeAndPosPhase) * 0.5 + 0.5) * uPulseAmount + (1.0 - uPulseAmount);
      
      // Fresnel effect
      float fresnelTerm = pow(1.0 - abs(dot(vNormal, vViewDirection)), uFresnelPower);
      
      // Base shield color
      vec3 baseShieldColor = mix(uColor, uGlowColor, lineRegion);
      
      // Environment Reflection
      vec3 envColor = vec3(0.0);
      if (uReflectivity > 0.001) {
         vec2 envUV = vec2(atan(vReflect.x, vReflect.z) / (2.0 * 3.1415926535) + 0.5, 
                           acos(vReflect.y) / 3.1415926535);
         envColor = texture2D(uEnvMap, envUV).rgb;
      }
      
      // Combine shield color with reflection
      vec3 finalColor = mix(baseShieldColor, envColor, uReflectivity * (fresnelTerm + 0.2)); 
      finalColor = mix(finalColor, baseShieldColor, lineRegion * 0.5); // Ensure lines are somewhat preserved over bright reflections

      // Opacity calculation
      float fillOpacity = uBaseOpacity * pulse;
      float lineOpacity = (uBaseOpacity * 1.2 + fresnelTerm * 0.3) * pulse; 
      float currentAlpha = mix(fillOpacity, lineOpacity, lineRegion);
      currentAlpha += fresnelTerm * 0.15; // Fresnel adds to opacity on edges

      // Hit effect
      if (uHitEffectTime > 0.0) {
          finalColor = mix(finalColor, vec3(1.8, 2.0, 2.2) * uGlowColor, uHitEffectTime); 
          currentAlpha = mix(currentAlpha, 0.85, uHitEffectTime); 
      }

      currentAlpha = clamp(currentAlpha, 0.0, 1.0);

      if (currentAlpha < 0.005) discard;

      gl_FragColor = vec4(finalColor, currentAlpha);
    }
  `
};

export { HexShieldShader };
