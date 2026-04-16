/* eslint-disable react-hooks/immutability */

import React, { useState, useEffect } from 'react';
import { useGraph, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { VISEMES } from 'wawa-lipsync';
import type { Lipsync } from 'wawa-lipsync';
import { getLipsyncManager } from '../audio/lipsyncManager';

// Map from wawa-lipsync viseme enums to Jane's morph target names.
const VISEME_MAP: Record<VISEMES, string> = {
  [VISEMES.sil]: 'None',          // silence
  [VISEMES.PP]: 'V_Explosive',    // B, M, P — lip burst
  [VISEMES.FF]: 'V_Dental_Lip',   // F, V — lower lip on upper teeth
  [VISEMES.TH]: 'V_Dental_Lip',   // Th — tongue between teeth, similar to FF
  [VISEMES.DD]: 'None',           // T, L, D — slight open covered by V_Lip_Open overlay
  [VISEMES.kk]: 'V_Open',         // K, G — back-of-throat open
  [VISEMES.CH]: 'V_Affricate',    // Ch, J — affricate shape
  [VISEMES.SS]: 'V_Tight',        // S, Z — teeth close, sibilant
  [VISEMES.nn]: 'None',           // N — nasal, slight open covered by V_Lip_Open overlay
  [VISEMES.RR]: 'V_Tight_O',      // R — slight rounded/bunched
  [VISEMES.aa]: 'V_Open',         // Ah — wide open
  [VISEMES.E]: 'V_Wide',          // EE — stretched wide
  [VISEMES.I]: 'V_Wide',          // Ih — wide
  [VISEMES.O]: 'V_Tight_O',       // Oh — rounded O
  [VISEMES.U]: 'Mouth_Pucker',    // OO, W — puckered
};

// Per-viseme morph target weight.
const VISEME_WEIGHT: Record<VISEMES, number> = {
  [VISEMES.sil]: 0,
  [VISEMES.PP]: 1.0,
  [VISEMES.FF]: 0.85,
  [VISEMES.TH]: 0.8,
  [VISEMES.DD]: 0,
  [VISEMES.kk]: 1.0,
  [VISEMES.CH]: 0.9,
  [VISEMES.SS]: 0.75,
  [VISEMES.nn]: 0,
  [VISEMES.RR]: 0.85,
  [VISEMES.aa]: 1.0,
  [VISEMES.E]: 0.9,
  [VISEMES.I]: 0.8,
  [VISEMES.O]: 0.95,
  [VISEMES.U]: 0.9,
};

const SPEECH_MORPHS = [
  'V_Explosive', 'V_Dental_Lip', 'V_Tight',
  'V_Open', 'V_Affricate', 'V_Tight_O', 'V_Wide', 'Mouth_Pucker',
];

export function Jane() {
  const modelPath = 'https://cdn.jsdelivr.net/gh/navodPeiris/agentic-avatars@models/Jane/Jane.glb';
  const group = React.useRef<THREE.Group>(null);

  const { scene, animations } = useGLTF(modelPath);
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone);

  const morphableMesh = nodes.CC_Base_Body_2 as THREE.Mesh;

  // ── Morph target lerp helper ─────────────────────────────────────────────

  const lerpMorph = (name: string, value: number, speed = 0.4) => {
    const idx = morphableMesh.morphTargetDictionary![name];
    const inf = morphableMesh.morphTargetInfluences;
    if (idx === undefined || !inf) return;
    inf[idx] = THREE.MathUtils.lerp(inf[idx], value, speed);
  };

  // ── Blink loop ────────────────────────────────────────────────────────────

  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      timeout = setTimeout(() => {
        setBlink(true);
        setTimeout(() => {
          setBlink(false);
          scheduleBlink();
        }, 200);
      }, THREE.MathUtils.randInt(1000, 5000));
    };
    scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  // ── Per-frame: blink + lipsync ────────────────────────────────────────────

  useFrame(() => {
    lerpMorph('Eyes_Blink', blink ? 1 : 0, 0.5);

    // Resolve active viseme
    const lipsync = getLipsyncManager() as Lipsync | null;
    const targetName = lipsync ? VISEME_MAP[lipsync.viseme] : 'None';
    const targetWeight = lipsync ? VISEME_WEIGHT[lipsync.viseme] : 0;
    const isSpeaking = targetName !== 'None';

    // Lerp each speech morph — active toward its weighted target, rest toward 0.
    for (const morphName of SPEECH_MORPHS) {
      const isActive = morphName === targetName;
      lerpMorph(morphName, isActive ? targetWeight : 0, isActive ? 0.35 : 0.2);
    }

    // Idle/talking overlays
    lerpMorph('Mouth_Smile_L', isSpeaking ? 0 : 0.35, 0.1);
    lerpMorph('Mouth_Smile_R', isSpeaking ? 0 : 0.35, 0.1);
    lerpMorph('Cheek_Raise_L', isSpeaking ? 0 : 0.25, 0.1);
    lerpMorph('Cheek_Raise_R', isSpeaking ? 0 : 0.25, 0.1);
    lerpMorph('Brow_Raise_Inner_L', isSpeaking ? 0.3 : 0, 0.08);
    lerpMorph('Brow_Raise_Inner_R', isSpeaking ? 0.3 : 0, 0.08);
    lerpMorph('V_Lip_Open', isSpeaking ? 0.6 : 0, 0.8);
  });

  // ── JSX ──────────────────────────────────────────────────────────────────

  const sm = (name: string) => nodes[name] as THREE.SkinnedMesh;

  return (
    <group ref={group} dispose={null}>
      <group name="Scene">
        <group name="Armature" scale={0.01}>
          <primitive object={nodes.CC_Base_BoneRoot} />
        </group>
        <skinnedMesh name="Bra" geometry={sm("Bra").geometry} material={materials.Bra} skeleton={sm("Bra").skeleton} scale={0.01} />
        <skinnedMesh name="High_Heels" geometry={sm("High_Heels").geometry} material={materials.High_Heels} skeleton={sm("High_Heels").skeleton} scale={0.01} />
        <skinnedMesh name="Knee_length_skirt" geometry={sm("Knee_length_skirt").geometry} material={materials.Knee_length_skirt} skeleton={sm("Knee_length_skirt").skeleton} scale={0.01} />
        <skinnedMesh name="Turtleneck_sweater" geometry={sm("Turtleneck_sweater").geometry} material={materials.Turtleneck_sweater} skeleton={sm("Turtleneck_sweater").skeleton} scale={0.01} />
        <skinnedMesh name="Underwear_Bottoms" geometry={sm("Underwear_Bottoms").geometry} material={materials.Underwear_Bottoms} skeleton={sm("Underwear_Bottoms").skeleton} scale={0.01} />
        <group name="CC_Base_Body" scale={0.01}>
          <skinnedMesh name="CC_Base_Body_1" geometry={sm("CC_Base_Body_1").geometry} material={materials.Std_Tongue} skeleton={sm("CC_Base_Body_1").skeleton} morphTargetDictionary={sm("CC_Base_Body_1").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_1").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_2" geometry={sm("CC_Base_Body_2").geometry} material={materials.Std_Skin_Head} skeleton={sm("CC_Base_Body_2").skeleton} morphTargetDictionary={sm("CC_Base_Body_2").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_2").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_3" geometry={sm("CC_Base_Body_3").geometry} material={materials.Std_Skin_Body} skeleton={sm("CC_Base_Body_3").skeleton} morphTargetDictionary={sm("CC_Base_Body_3").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_3").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_4" geometry={sm("CC_Base_Body_4").geometry} material={materials.Std_Skin_Arm} skeleton={sm("CC_Base_Body_4").skeleton} morphTargetDictionary={sm("CC_Base_Body_4").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_4").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_5" geometry={sm("CC_Base_Body_5").geometry} material={materials.Std_Skin_Leg} skeleton={sm("CC_Base_Body_5").skeleton} morphTargetDictionary={sm("CC_Base_Body_5").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_5").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_6" geometry={sm("CC_Base_Body_6").geometry} material={materials.Std_Nails} skeleton={sm("CC_Base_Body_6").skeleton} morphTargetDictionary={sm("CC_Base_Body_6").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_6").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_7" geometry={sm("CC_Base_Body_7").geometry} material={materials.Std_Eyelash} skeleton={sm("CC_Base_Body_7").skeleton} morphTargetDictionary={sm("CC_Base_Body_7").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_7").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_8" geometry={sm("CC_Base_Body_8").geometry} material={materials.Std_Upper_Teeth} skeleton={sm("CC_Base_Body_8").skeleton} morphTargetDictionary={sm("CC_Base_Body_8").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_8").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_9" geometry={sm("CC_Base_Body_9").geometry} material={materials.Std_Lower_Teeth} skeleton={sm("CC_Base_Body_9").skeleton} morphTargetDictionary={sm("CC_Base_Body_9").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_9").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_10" geometry={sm("CC_Base_Body_10").geometry} material={materials.Std_Eye_R} skeleton={sm("CC_Base_Body_10").skeleton} morphTargetDictionary={sm("CC_Base_Body_10").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_10").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_11" geometry={sm("CC_Base_Body_11").geometry} material={materials.Std_Cornea_R} skeleton={sm("CC_Base_Body_11").skeleton} morphTargetDictionary={sm("CC_Base_Body_11").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_11").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_12" geometry={sm("CC_Base_Body_12").geometry} material={materials.Std_Eye_L} skeleton={sm("CC_Base_Body_12").skeleton} morphTargetDictionary={sm("CC_Base_Body_12").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_12").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_13" geometry={sm("CC_Base_Body_13").geometry} material={materials.Std_Cornea_L} skeleton={sm("CC_Base_Body_13").skeleton} morphTargetDictionary={sm("CC_Base_Body_13").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_13").morphTargetInfluences} />
        </group>
        <group name="CC_Base_EyeOcclusion" scale={0.01}>
          <skinnedMesh name="CC_Base_EyeOcclusion_1" geometry={sm("CC_Base_EyeOcclusion_1").geometry} material={materials.Std_Eye_Occlusion_R} skeleton={sm("CC_Base_EyeOcclusion_1").skeleton} morphTargetDictionary={sm("CC_Base_EyeOcclusion_1").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_EyeOcclusion_1").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_EyeOcclusion_2" geometry={sm("CC_Base_EyeOcclusion_2").geometry} material={materials.Std_Eye_Occlusion_R} skeleton={sm("CC_Base_EyeOcclusion_2").skeleton} morphTargetDictionary={sm("CC_Base_EyeOcclusion_2").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_EyeOcclusion_2").morphTargetInfluences} />
        </group>
        <group name="Female_Angled" scale={0.01}>
          <skinnedMesh name="Female_Angled_1" geometry={sm("Female_Angled_1").geometry} material={materials.Female_Angled_Transparency} skeleton={sm("Female_Angled_1").skeleton} morphTargetDictionary={sm("Female_Angled_1").morphTargetDictionary} morphTargetInfluences={sm("Female_Angled_1").morphTargetInfluences} />
          <skinnedMesh name="Female_Angled_2" geometry={sm("Female_Angled_2").geometry} material={materials.Female_Angled_Base_Transparency} skeleton={sm("Female_Angled_2").skeleton} morphTargetDictionary={sm("Female_Angled_2").morphTargetDictionary} morphTargetInfluences={sm("Female_Angled_2").morphTargetInfluences} />
        </group>
        <group name="Side_part_wavy" scale={0.01}>
          <skinnedMesh name="Side_part_wavy_1" geometry={sm("Side_part_wavy_1").geometry} material={materials.Scalp_Transparency} skeleton={sm("Side_part_wavy_1").skeleton} morphTargetDictionary={sm("Side_part_wavy_1").morphTargetDictionary} morphTargetInfluences={sm("Side_part_wavy_1").morphTargetInfluences} />
          <skinnedMesh name="Side_part_wavy_2" geometry={sm("Side_part_wavy_2").geometry} material={materials.Hair_Transparency} skeleton={sm("Side_part_wavy_2").skeleton} morphTargetDictionary={sm("Side_part_wavy_2").morphTargetDictionary} morphTargetInfluences={sm("Side_part_wavy_2").morphTargetInfluences} />
        </group>
      </group>
    </group>
  );
}
