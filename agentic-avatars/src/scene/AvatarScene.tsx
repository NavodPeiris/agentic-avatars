import { CameraControls } from '@react-three/drei';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Avatar } from './Avatar';
import { Background } from './Background';

// ── Transparency fix for Reallusion CC characters ─────────────────────────

function SceneConfig() {
  const { scene } = useThree();

  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;

      const name = mesh.name.toLowerCase();
      const isHair = name.includes('hair') || name.includes('wavy') || name.includes('scalp') || name.includes('brow_hair');
      const isBrow = name.includes('brow') && !isHair;
      const isEyeOverlay =
        name.includes('eye') ||
        name.includes('tear') ||
        name.includes('cornea') ||
        name.includes('occlusion');

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat: THREE.Material) => {
        const m = mat as THREE.MeshStandardMaterial;
        // Only fix depthWrite — never touch alphaTest (would destroy hair edges)
        if (m.transparent || m.alphaTest > 0) {
          mat.depthWrite = false;
          mat.needsUpdate = true;
        }
      });

      // Enforce back-to-front draw order for transparent face layers:
      // eyebrows (1) → eye details (2) → hair (3)
      if (isBrow) mesh.renderOrder = 1;
      else if (isEyeOverlay) mesh.renderOrder = 2;
      else if (isHair) mesh.renderOrder = 3;
    });
  }, [scene]);

  return null;
}

// ── Scene ────────────────────────────────────────────────────────────────

interface AvatarSceneProps {
  backgroundImages: string[];
  modelPath: string;
}

import type { CameraControls as CameraControlsImpl } from '@react-three/drei';

export function AvatarScene({ backgroundImages, modelPath }: AvatarSceneProps) {
  const controls = useRef<CameraControlsImpl | null>(null);

  useLayoutEffect(() => {
    if (!controls.current) return;
    controls.current.setLookAt(
      0, 1.65, 0.7, // camera
      0, 1.65, 0,  // target
      false,
    );
  });

  return (
    <>
      <SceneConfig />
      <CameraControls ref={controls} />

      {backgroundImages.length > 0 && <Background images={backgroundImages} />}

      <ambientLight intensity={0.7} />
      <directionalLight position={[1, 1.5, 3]} intensity={2} />

      <Avatar modelPath={modelPath} />
    </>
  );
}
