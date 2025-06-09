
import * as THREE from 'three';

interface ChromaticAberrationShaderUniforms {
  tDiffuse: { value: THREE.Texture | null };
  redOffset: { value: THREE.Vector2 };
  greenOffset: { value: THREE.Vector2 };
  blueOffset: { value: THREE.Vector2 };
}

const ChromaticAberrationShader: {
  uniforms: ChromaticAberrationShaderUniforms;
  vertexShader: string;
  fragmentShader: string;
} = {
  uniforms: {
    tDiffuse: { value: null },
    // Default values, will be specifically set in Game.ts
    redOffset: { value: new THREE.Vector2(0.0, 0.0) }, 
    greenOffset: { value: new THREE.Vector2(-0.0, -0.0) },
    blueOffset: { value: new THREE.Vector2(-0.0, -0.0) },
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 redOffset;
    uniform vec2 greenOffset;
    uniform vec2 blueOffset;
    varying vec2 vUv;

    void main() {
      float r = texture2D(tDiffuse, vUv + redOffset).r;
      float g = texture2D(tDiffuse, vUv + greenOffset).g;
      float b = texture2D(tDiffuse, vUv + blueOffset).b;
      // Preserve original alpha from the non-offsetted texture sample
      float a = texture2D(tDiffuse, vUv).a; 

      gl_FragColor = vec4(r, g, b, a);
    }
  `
};

export { ChromaticAberrationShader };
