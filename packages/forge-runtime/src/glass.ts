import { Color, Mesh, MeshPhysicalMaterial, type Object3D } from "three";
import type { QualityTier } from "./index.ts";

export interface MoltenUniform {
  value: number;
}

/** Live uniforms for the helix glass. The stage writes time each frame. */
export const moltenTime: MoltenUniform = { value: 0 };

const FLOW = /* glsl */ `
varying vec3 vForgeWorld;
varying vec3 vForgeNormal;
uniform float uForgeTime;
uniform float uForgeRich;
`;

/**
 * Heavier, glossier glass for the Forge ribbons.
 * Desktop keeps transmission and fakes thickness absorption.
 * Quest and phones keep an emissive molten flow and a cyan fresnel rim.
 */
export function dressForgeGlass(root: Object3D, tier: QualityTier) {
  const rich = tier === "high";
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (!material.name.includes("IridescentGlass")) continue;
      const glass = material as MeshPhysicalMaterial;
      glass.roughness = rich ? 0.06 : 0.28;
      glass.metalness = 0.04;
      glass.clearcoat = rich ? 1 : 0.35;
      glass.clearcoatRoughness = rich ? 0.08 : 0.4;
      glass.ior = 1.5;
      glass.thickness = rich ? 1.6 : 0.2;
      glass.transmission = rich ? 0.62 : 0;
      glass.attenuationColor = new Color(0xff6a22);
      glass.attenuationDistance = rich ? 0.85 : 4;
      glass.emissive = new Color(rich ? 0x3a1020 : 0xff5a18);
      glass.emissiveIntensity = rich ? 0.35 : 1.15;
      glass.transparent = !rich;
      glass.opacity = rich ? 1 : 0.92;
      glass.userData.transmission = glass.transmission;
      glass.onBeforeCompile = (shader) => {
        shader.uniforms.uForgeTime = moltenTime;
        shader.uniforms.uForgeRich = { value: rich ? 1 : 0 };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${FLOW}`)
          .replace(
            "#include <worldpos_vertex>",
            `#include <worldpos_vertex>
vForgeWorld = worldPosition.xyz;
vForgeNormal = normalize(mat3(modelMatrix) * objectNormal);`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\n${FLOW}`)
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
{
  vec3 forgeN = normalize(vForgeNormal);
  vec3 forgeV = normalize(cameraPosition - vForgeWorld);
  float fres = pow(1.0 - clamp(abs(dot(forgeN, forgeV)), 0.0, 1.0), 2.35);
  float wave = vForgeWorld.y * 0.38 + sin(vForgeWorld.x * 0.33 + uForgeTime * 0.55) * 0.55;
  float flow = 0.5 + 0.5 * sin(wave - uForgeTime * 0.8);
  vec3 amber = vec3(1.0, 0.46, 0.1);
  vec3 magenta = vec3(1.0, 0.16, 0.52);
  vec3 violet = vec3(0.42, 0.22, 1.0);
  vec3 molten = mix(amber, magenta, smoothstep(0.12, 0.62, flow));
  molten = mix(molten, violet, smoothstep(0.5, 0.95, flow));
  vec3 rim = vec3(0.22, 0.95, 0.9) * fres;
  float glow = uForgeRich > 0.5 ? 0.5 : 1.2;
  totalEmissiveRadiance += molten * glow + rim * (uForgeRich > 0.5 ? 0.65 : 1.1);
  if (uForgeRich > 0.5) {
    float thick = fres * 1.35 + 0.28;
    vec3 absorb = exp(-vec3(0.2, 1.55, 2.15) * thick);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * absorb + molten * 0.22, 0.85);
  }
}`,
          );
      };
      glass.needsUpdate = true;
    }
  });
}
