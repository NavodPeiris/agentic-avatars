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
// adapt the map if you swap in a different avatar with different morph target naming!
const VISEME_MAP: Record<VISEMES, string> = {
  [VISEMES.sil]: 'None',        // silence — triggers idle expression
  [VISEMES.PP]: 'Explosive',    // B, M, P — lip burst
  [VISEMES.FF]: 'Dental_Lip',   // F, V — lower lip on upper teeth
  [VISEMES.TH]: 'Tight',        // Th — tight with tongue forward
  [VISEMES.DD]: 'Lip_Open',     // T, L, D, N — slight lip opening
  [VISEMES.kk]: 'Open',         // K, G, H, NG — open throat/mouth
  [VISEMES.CH]: 'Affricate',    // Ch, J — affricate shape
  [VISEMES.SS]: 'Tight',        // S, Z — sibilant, teeth close
  [VISEMES.nn]: 'Lip_Open',     // N — nasal, lips slightly parted
  [VISEMES.RR]: 'Tight_O',      // R — slight rounded shape
  [VISEMES.aa]: 'Open',         // Ah — wide open mouth
  [VISEMES.E]: 'Wide',          // EE — wide smile-like
  [VISEMES.I]: 'Wide',          // Ih — wide
  [VISEMES.O]: 'Tight_O',       // Oh — rounded O
  [VISEMES.U]: 'Mouth_Pucker',  // OO, W — puckered lips
};

export function Fiona() {
  const modelPath = 'https://cdn.jsdelivr.net/gh/navodPeiris/agentic-avatars@models/Fiona/Fiona.glb';
  const group = React.useRef<THREE.Group>(null);

  const { scene, animations } = useGLTF(modelPath);
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone);

  const morphableMesh = nodes.CC_Base_Body_1 as THREE.Mesh;

  // ── Morph target helpers ─────────────────────────────────────────────────

  const resetAllMorphTargets = () => {
    const blink = morphableMesh.morphTargetDictionary!['Eye_Blink'];
    const inf = morphableMesh.morphTargetInfluences;
    if (!inf) return;
    for (let i = 0; i < inf.length; i++) {
      if (i !== blink) inf[i] = 0;
    }
  };

  const lerpMorph = (name: string, value: number, speed = 0.4) => {
    const idx = morphableMesh.morphTargetDictionary![name];
    const inf = morphableMesh.morphTargetInfluences;
    if (idx === undefined || !inf) return;
    inf[idx] = THREE.MathUtils.lerp(inf[idx], value, speed);
  };

  const handleBlink = (value: number) => {
    lerpMorph('Eye_Blink', value);
  };

  const applyIdleExpression = () => {
    lerpMorph('Mouth_Smile_L', 0.4);
    lerpMorph('Mouth_Smile_R', 0.4);
    lerpMorph('Cheek_Raise_L', 0.3);
    lerpMorph('Cheek_Raise_R', 0.3);
  };

  const applyTalkingExpression = () => {
    lerpMorph('Lip_Open', 1, 0.6);  // lip opening is the main talking expression, so we lerp it faster for snappier response
    lerpMorph('Brow_Raise_Inner_L', 0.6, 0.25);
    lerpMorph('Brow_Raise_Inner_R', 0.6, 0.25);
  };

  const handleMorph = (name: string) => {
    resetAllMorphTargets();
    lerpMorph(name, 1);
    if (name === 'None') {
      applyIdleExpression();
    } else {
      applyTalkingExpression();
    }
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
    handleBlink(blink ? 1 : 0);
    const lipsync = getLipsyncManager() as Lipsync | null;
    if (!lipsync) return;
    handleMorph(VISEME_MAP[lipsync.viseme]);
  });

  // ── JSX ──────────────────────────────────────────────────────────────────

  const sm = (name: string) => nodes[name] as THREE.SkinnedMesh;

  return (
    <group ref={group} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
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
