/* eslint-disable react-hooks/immutability */

import React, { useState, useEffect } from 'react';
import { useGraph, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { VISEMES } from 'wawa-lipsync';
import type { Lipsync } from 'wawa-lipsync';
import { getLipsyncManager } from '../audio/lipsyncManager';

// Map from wawa-lipsync viseme enums to Fiona's morph target names.
const VISEME_MAP: Record<VISEMES, string> = {
  [VISEMES.sil]: 'None',        // silence
  [VISEMES.PP]: 'Explosive',    // B, M, P — lip burst (closed→burst)
  [VISEMES.FF]: 'Dental_Lip',   // F, V — lower lip on upper teeth
  [VISEMES.TH]: 'Dental_Lip',   // Th — tongue between teeth, similar to FF
  [VISEMES.DD]: 'None',          // T, L, D — slight open covered by Lip_Open overlay
  [VISEMES.kk]: 'Open',         // K, G — back-of-throat open
  [VISEMES.CH]: 'Affricate',    // Ch, J — affricate shape
  [VISEMES.SS]: 'Tight',        // S, Z — teeth close, sibilant
  [VISEMES.nn]: 'None',          // N — nasal, slight open covered by Lip_Open overlay
  [VISEMES.RR]: 'Tight_O',      // R — slight rounded/bunched
  [VISEMES.aa]: 'Open',         // Ah — wide open
  [VISEMES.E]: 'Wide',          // EE — stretched wide
  [VISEMES.I]: 'Wide',          // Ih — wide
  [VISEMES.O]: 'Tight_O',       // Oh — rounded O
  [VISEMES.U]: 'Mouth_Pucker',  // OO, W — puckered
};

// Per-viseme morph target weight — not all phonemes open the mouth equally.
const VISEME_WEIGHT: Record<VISEMES, number> = {
  [VISEMES.sil]: 0,
  [VISEMES.PP]: 1.0,   // explosive — full closed-burst
  [VISEMES.FF]: 0.85,  // dental
  [VISEMES.TH]: 0.8,   // dental-ish
  [VISEMES.DD]: 0.75,  // slight open
  [VISEMES.kk]: 1.0,   // open
  [VISEMES.CH]: 0.9,   // affricate
  [VISEMES.SS]: 0.75,  // tight
  [VISEMES.nn]: 0.65,  // nasal
  [VISEMES.RR]: 0.85,  // rounded
  [VISEMES.aa]: 1.0,   // wide open — full
  [VISEMES.E]: 0.9,    // wide
  [VISEMES.I]: 0.8,    // wide
  [VISEMES.O]: 0.95,   // rounded O
  [VISEMES.U]: 0.9,    // pucker
};

// All morph target names driven by speech (used to lerp inactive ones → 0).
const SPEECH_MORPHS = [
  'Explosive', 'Dental_Lip', 'Tight',
  'Open', 'Affricate', 'Tight_O', 'Wide', 'Mouth_Pucker',
];

export function Fiona() {
  const modelPath = 'https://cdn.jsdelivr.net/gh/navodPeiris/agentic-avatars@models/Fiona/Fiona.glb';
  const group = React.useRef<THREE.Group>(null);

  const { scene, animations } = useGLTF(modelPath);
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone);

  const morphableMesh = nodes.CC_Base_Body_1 as THREE.Mesh;

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
    // Blink
    lerpMorph('Eye_Blink', blink ? 1 : 0, 0.5);

    // Resolve active viseme
    const lipsync = getLipsyncManager() as Lipsync | null;
    const targetName = lipsync ? VISEME_MAP[lipsync.viseme] : 'None';
    const targetWeight = lipsync ? VISEME_WEIGHT[lipsync.viseme] : 0;
    const isSpeaking = targetName !== 'None';

    // Lerp each speech morph — active toward its weighted target, rest toward 0.
    // Faster speeds mean less morph overlap and more distinct mouth shapes.
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
    lerpMorph('Lip_Open', isSpeaking ? 0.6 : 0, 0.8);
  });

  // ── JSX ──────────────────────────────────────────────────────────────────

  const sm = (name: string) => nodes[name] as THREE.SkinnedMesh;

  return (
    <group ref={group} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.0098}>
          <primitive object={nodes.CC_Base_BoneRoot} />
        </group>
        <skinnedMesh name="Camisole" geometry={sm("Camisole").geometry} material={materials.Dress} skeleton={sm("Camisole").skeleton} rotation={[Math.PI / 2, 0, 0]} scale={0.01} />
        <group name="CC_Base_Eye" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh name="CC_Base_Eye_1" geometry={sm("CC_Base_Eye_1").geometry} material={materials.Std_Eye_R} skeleton={sm("CC_Base_Eye_1").skeleton} />
          <skinnedMesh name="CC_Base_Eye_2" geometry={sm("CC_Base_Eye_2").geometry} material={materials.Std_Cornea_R} skeleton={sm("CC_Base_Eye_2").skeleton} />
          <skinnedMesh name="CC_Base_Eye_3" geometry={sm("CC_Base_Eye_3").geometry} material={materials.Std_Eye_L} skeleton={sm("CC_Base_Eye_3").skeleton} />
          <skinnedMesh name="CC_Base_Eye_4" geometry={sm("CC_Base_Eye_4").geometry} material={materials.Std_Cornea_L} skeleton={sm("CC_Base_Eye_4").skeleton} />
        </group>
        <group name="CC_Base_Teeth" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh name="CC_Base_Teeth_1" geometry={sm("CC_Base_Teeth_1").geometry} material={materials.Std_Upper_Teeth} skeleton={sm("CC_Base_Teeth_1").skeleton} />
          <skinnedMesh name="CC_Base_Teeth_2" geometry={sm("CC_Base_Teeth_2").geometry} material={materials.Std_Lower_Teeth} skeleton={sm("CC_Base_Teeth_2").skeleton} />
        </group>
        <group name="Hair" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh name="Hair_1" geometry={sm("Hair_1").geometry} material={materials.scalp_long_straight} skeleton={sm("Hair_1").skeleton} />
          <skinnedMesh name="Hair_2" geometry={sm("Hair_2").geometry} material={materials.long_straight} skeleton={sm("Hair_2").skeleton} />
        </group>
        <skinnedMesh name="Punk_Leather_Jacket" geometry={sm("Punk_Leather_Jacket").geometry} material={materials.Punk_Leather_jacket} skeleton={sm("Punk_Leather_Jacket").skeleton} rotation={[Math.PI / 2, 0, 0]} scale={0.01} />
        <skinnedMesh name="Punk_Strap_Boots" geometry={sm("Punk_Strap_Boots").geometry} material={materials.Punk_Strap_Boots} skeleton={sm("Punk_Strap_Boots").skeleton} rotation={[Math.PI / 2, 0, 0]} scale={0.01} />
        <skinnedMesh name="Trouser" geometry={sm("Trouser").geometry} material={materials.Trouser} skeleton={sm("Trouser").skeleton} rotation={[Math.PI / 2, 0, 0]} scale={0.01} />
        <group name="CC_Base_Body" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh name="CC_Base_Body_1" geometry={sm("CC_Base_Body_1").geometry} material={materials.Std_Skin_Head} skeleton={sm("CC_Base_Body_1").skeleton} morphTargetDictionary={sm("CC_Base_Body_1").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_1").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_2" geometry={sm("CC_Base_Body_2").geometry} material={materials.Std_Skin_Body} skeleton={sm("CC_Base_Body_2").skeleton} morphTargetDictionary={sm("CC_Base_Body_2").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_2").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_3" geometry={sm("CC_Base_Body_3").geometry} material={materials.Std_Skin_Arm} skeleton={sm("CC_Base_Body_3").skeleton} morphTargetDictionary={sm("CC_Base_Body_3").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_3").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_4" geometry={sm("CC_Base_Body_4").geometry} material={materials.Std_Skin_Leg} skeleton={sm("CC_Base_Body_4").skeleton} morphTargetDictionary={sm("CC_Base_Body_4").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_4").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_5" geometry={sm("CC_Base_Body_5").geometry} material={materials.Std_Nails} skeleton={sm("CC_Base_Body_5").skeleton} morphTargetDictionary={sm("CC_Base_Body_5").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_5").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_6" geometry={sm("CC_Base_Body_6").geometry} material={materials.Std_Eyelash} skeleton={sm("CC_Base_Body_6").skeleton} morphTargetDictionary={sm("CC_Base_Body_6").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Body_6").morphTargetInfluences} />
        </group>
        <group name="CC_Base_EyeOcclusion" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh name="CC_Base_EyeOcclusion_1" geometry={sm("CC_Base_EyeOcclusion_1").geometry} material={materials.Std_Eye_Occlusion_R} skeleton={sm("CC_Base_EyeOcclusion_1").skeleton} morphTargetDictionary={sm("CC_Base_EyeOcclusion_1").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_EyeOcclusion_1").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_EyeOcclusion_2" geometry={sm("CC_Base_EyeOcclusion_2").geometry} material={materials.Std_Eye_Occlusion_R} skeleton={sm("CC_Base_EyeOcclusion_2").skeleton} morphTargetDictionary={sm("CC_Base_EyeOcclusion_2").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_EyeOcclusion_2").morphTargetInfluences} />
        </group>
        <group name="CC_Base_TearLine" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <skinnedMesh name="CC_Base_TearLine_1" geometry={sm("CC_Base_TearLine_1").geometry} material={materials.Std_Tearline_R} skeleton={sm("CC_Base_TearLine_1").skeleton} morphTargetDictionary={sm("CC_Base_TearLine_1").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_TearLine_1").morphTargetInfluences} />
          <skinnedMesh name="CC_Base_TearLine_2" geometry={sm("CC_Base_TearLine_2").geometry} material={materials.Std_Tearline_R} skeleton={sm("CC_Base_TearLine_2").skeleton} morphTargetDictionary={sm("CC_Base_TearLine_2").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_TearLine_2").morphTargetInfluences} />
        </group>
        <skinnedMesh name="CC_Base_Tongue" geometry={sm("CC_Base_Tongue").geometry} material={materials.Std_Tongue} skeleton={sm("CC_Base_Tongue").skeleton} morphTargetDictionary={sm("CC_Base_Tongue").morphTargetDictionary} morphTargetInfluences={sm("CC_Base_Tongue").morphTargetInfluences} rotation={[Math.PI / 2, 0, 0]} scale={0.01} />
      </group>
    </group>
  );
}
