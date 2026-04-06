/* eslint-disable react-hooks/immutability */

import React, { useState, useEffect } from 'react';
import { useGraph, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { VISEMES } from 'wawa-lipsync';
import { getLipsyncManager } from '../audio/lipsyncManager';

const VISEME_MAP: Record<VISEMES, string> = {
  [VISEMES.sil]: 'None',
  [VISEMES.PP]: 'B_M_P',
  [VISEMES.FF]: 'F_V',
  [VISEMES.TH]: 'Th',
  [VISEMES.DD]: 'T_L_D_N',
  [VISEMES.kk]: 'K_G_H_NG',
  [VISEMES.CH]: 'Ch_J',
  [VISEMES.SS]: 'S_Z',
  [VISEMES.nn]: 'T_L_D_N',
  [VISEMES.RR]: 'R',
  [VISEMES.aa]: 'Ah',
  [VISEMES.E]: 'EE',
  [VISEMES.I]: 'Ih',
  [VISEMES.O]: 'Oh',
  [VISEMES.U]: 'W_OO',
};

interface AvatarProps {
  modelPath: string;
}

export function Avatar({ modelPath }: AvatarProps) {
  const group = React.useRef<THREE.Group>(null);

  const { scene, animations } = useGLTF(modelPath);
  const clone = React.useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes, materials } = useGraph(clone);
  const { actions } = useAnimations(animations, group);

  const morphableMesh = nodes.CC_Base_Body_1 as THREE.Mesh;

  useEffect(() => {
    const action = actions['hd_avatar_8k|A|4155572034304_TempMotion'];
    if (!action) return;
    action.enabled = true;
    action.setLoop(THREE.LoopPingPong, Infinity);
    action.clampWhenFinished = true;
    action.time = 1;
    action.play();
    return () => { action.stop(); };
  }, [actions]);

  // ── Morph target helpers ─────────────────────────────────────────────────

  const resetAllMorphTargets = () => {
    const blinkL = morphableMesh.morphTargetDictionary!['Eye_Blink_L'];
    const blinkR = morphableMesh.morphTargetDictionary!['Eye_Blink_R'];
    const inf = morphableMesh.morphTargetInfluences;
    if (!inf) return;
    for (let i = 0; i < inf.length; i++) {
      if (i !== blinkL && i !== blinkR) inf[i] = 0;
    }
  };

  const lerpMorph = (name: string, value: number, speed = 0.4) => {
    const idx = morphableMesh.morphTargetDictionary![name];
    const inf = morphableMesh.morphTargetInfluences;
    if (idx === undefined || !inf) return;
    inf[idx] = THREE.MathUtils.lerp(inf[idx], value, speed);
  };

  const handleBlink = (value: number) => {
    lerpMorph('Eye_Blink_L', value);
    lerpMorph('Eye_Blink_R', value);
  };

  const applyIdleExpression = () => {
    lerpMorph('Mouth_Smile_L', 0.5);
    lerpMorph('Mouth_Smile_R', 0.5);
    lerpMorph('Mouth_Smile_Sharp_R', 0.5);
    lerpMorph('Cheek_Raise_R', 0.5);
  };

  const applyTalkingExpression = () => {
    lerpMorph('K_G_H_NG', 1);
    lerpMorph('Brow_Raise_Inner_L', 1, 0.25);
    lerpMorph('Brow_Raise_Inner_R', 1, 0.25);
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
    const lipsync = getLipsyncManager();
    if (!lipsync) return;
    handleMorph(VISEME_MAP[lipsync.viseme]);
  });

  // ── JSX ──────────────────────────────────────────────────────────────────

  const sm = (name: string) => nodes[name] as THREE.SkinnedMesh;

  return (
    <group ref={group} dispose={null}>
      <group name="Scene">
        <group name="hd_avatar_8k" scale={0.0108}>
          <primitive object={nodes.CC_Base_BoneRoot} />
        </group>
        <skinnedMesh name="Canvas_shoes" geometry={sm('Canvas_shoes').geometry} material={materials.Canvas_shoes} skeleton={sm('Canvas_shoes').skeleton} scale={0.01} />

        <group name="CC_Base_Teeth" scale={0.01}>
          <skinnedMesh name="CC_Base_Teeth_1" geometry={sm('CC_Base_Teeth_1').geometry} material={materials.Std_Upper_Teeth} skeleton={sm('CC_Base_Teeth_1').skeleton} />
          <skinnedMesh name="CC_Base_Teeth_2" geometry={sm('CC_Base_Teeth_2').geometry} material={materials.Std_Lower_Teeth} skeleton={sm('CC_Base_Teeth_2').skeleton} />
        </group>

        <skinnedMesh name="Rolled_sleeves_shirt" geometry={sm('Rolled_sleeves_shirt').geometry} material={materials.Rolled_sleeves_shirt} skeleton={sm('Rolled_sleeves_shirt').skeleton} scale={0.01} />
        <skinnedMesh name="Slim_fit_pants" geometry={sm('Slim_fit_pants').geometry} material={materials.Slim_fit_pants} skeleton={sm('Slim_fit_pants').skeleton} scale={0.01} />

        <group name="Camila_Brow" scale={0.01}>
          <skinnedMesh name="Camila_Brow_1" geometry={sm('Camila_Brow_1').geometry} material={materials.Female_Brow_Transparency} skeleton={sm('Camila_Brow_1').skeleton} morphTargetDictionary={sm('Camila_Brow_1').morphTargetDictionary} morphTargetInfluences={sm('Camila_Brow_1').morphTargetInfluences} />
          <skinnedMesh name="Camila_Brow_2" geometry={sm('Camila_Brow_2').geometry} material={materials.Female_Brow_Base_Transparency} skeleton={sm('Camila_Brow_2').skeleton} morphTargetDictionary={sm('Camila_Brow_2').morphTargetDictionary} morphTargetInfluences={sm('Camila_Brow_2').morphTargetInfluences} />
        </group>

        <group name="CC_Base_Body" scale={0.01}>
          <skinnedMesh name="CC_Base_Body_1" geometry={sm('CC_Base_Body_1').geometry} material={materials.Std_Skin_Head} skeleton={sm('CC_Base_Body_1').skeleton} morphTargetDictionary={sm('CC_Base_Body_1').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Body_1').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_2" geometry={sm('CC_Base_Body_2').geometry} material={materials.Std_Skin_Body} skeleton={sm('CC_Base_Body_2').skeleton} morphTargetDictionary={sm('CC_Base_Body_2').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Body_2').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_3" geometry={sm('CC_Base_Body_3').geometry} material={materials.Std_Skin_Arm} skeleton={sm('CC_Base_Body_3').skeleton} morphTargetDictionary={sm('CC_Base_Body_3').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Body_3').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_4" geometry={sm('CC_Base_Body_4').geometry} material={materials.Std_Skin_Leg} skeleton={sm('CC_Base_Body_4').skeleton} morphTargetDictionary={sm('CC_Base_Body_4').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Body_4').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_5" geometry={sm('CC_Base_Body_5').geometry} material={materials.Std_Nails} skeleton={sm('CC_Base_Body_5').skeleton} morphTargetDictionary={sm('CC_Base_Body_5').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Body_5').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Body_6" geometry={sm('CC_Base_Body_6').geometry} material={materials.Std_Eyelash} skeleton={sm('CC_Base_Body_6').skeleton} morphTargetDictionary={sm('CC_Base_Body_6').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Body_6').morphTargetInfluences} />
        </group>

        <group name="CC_Base_Eye" scale={0.01}>
          <skinnedMesh name="CC_Base_Eye_1" geometry={sm('CC_Base_Eye_1').geometry} material={materials.Std_Eye_R} skeleton={sm('CC_Base_Eye_1').skeleton} morphTargetDictionary={sm('CC_Base_Eye_1').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Eye_1').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Eye_2" geometry={sm('CC_Base_Eye_2').geometry} material={materials.Std_Cornea_R} skeleton={sm('CC_Base_Eye_2').skeleton} morphTargetDictionary={sm('CC_Base_Eye_2').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Eye_2').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Eye_3" geometry={sm('CC_Base_Eye_3').geometry} material={materials.Std_Eye_L} skeleton={sm('CC_Base_Eye_3').skeleton} morphTargetDictionary={sm('CC_Base_Eye_3').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Eye_3').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_Eye_4" geometry={sm('CC_Base_Eye_4').geometry} material={materials.Std_Cornea_R} skeleton={sm('CC_Base_Eye_4').skeleton} morphTargetDictionary={sm('CC_Base_Eye_4').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Eye_4').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_EyeOcclusion_1" geometry={sm('CC_Base_EyeOcclusion_1').geometry} material={materials.Std_Eye_Occlusion_R} skeleton={sm('CC_Base_EyeOcclusion_1').skeleton} morphTargetDictionary={sm('CC_Base_EyeOcclusion_1').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_EyeOcclusion_1').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_EyeOcclusion_2" geometry={sm('CC_Base_EyeOcclusion_2').geometry} material={materials.Std_Eye_Occlusion_R} skeleton={sm('CC_Base_EyeOcclusion_2').skeleton} morphTargetDictionary={sm('CC_Base_EyeOcclusion_2').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_EyeOcclusion_2').morphTargetInfluences} />
        </group>

        <group name="CC_Base_TearLine" scale={0.01}>
          <skinnedMesh name="CC_Base_TearLine_1" geometry={sm('CC_Base_TearLine_1').geometry} material={materials.Std_Tearline_R} skeleton={sm('CC_Base_TearLine_1').skeleton} morphTargetDictionary={sm('CC_Base_TearLine_1').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_TearLine_1').morphTargetInfluences} />
          <skinnedMesh name="CC_Base_TearLine_2" geometry={sm('CC_Base_TearLine_2').geometry} material={materials.Std_Tearline_R} skeleton={sm('CC_Base_TearLine_2').skeleton} morphTargetDictionary={sm('CC_Base_TearLine_2').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_TearLine_2').morphTargetInfluences} />
        </group>

        <skinnedMesh name="CC_Base_Tongue" geometry={sm('CC_Base_Tongue').geometry} material={materials.Std_Tongue} skeleton={sm('CC_Base_Tongue').skeleton} morphTargetDictionary={sm('CC_Base_Tongue').morphTargetDictionary} morphTargetInfluences={sm('CC_Base_Tongue').morphTargetInfluences} scale={0.01} />

        <group name="Side_part_wavy" scale={0.01}>
          <skinnedMesh name="Side_part_wavy_1" geometry={sm('Side_part_wavy_1').geometry} material={materials.Scalp_Transparency} skeleton={sm('Side_part_wavy_1').skeleton} morphTargetDictionary={sm('Side_part_wavy_1').morphTargetDictionary} morphTargetInfluences={sm('Side_part_wavy_1').morphTargetInfluences} />
          <skinnedMesh name="Side_part_wavy_2" geometry={sm('Side_part_wavy_2').geometry} material={materials.Hair_Transparency} skeleton={sm('Side_part_wavy_2').skeleton} morphTargetDictionary={sm('Side_part_wavy_2').morphTargetDictionary} morphTargetInfluences={sm('Side_part_wavy_2').morphTargetInfluences} />
        </group>
      </group>
    </group>
  );
}
