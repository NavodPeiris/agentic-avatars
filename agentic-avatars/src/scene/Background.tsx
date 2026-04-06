import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { useEffect, useMemo } from 'react';

interface BackgroundProps {
  images: string[];
}

/**
 * Sets the Three.js scene background to a randomly chosen image from `images`.
 * Renders nothing into the scene itself.
 */
export function Background({ images }: BackgroundProps) {
  const url = useMemo(
    () => images[Math.floor(Math.random() * images.length)],
    // Stable per mount — intentionally no dep on `images` reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const texture = useTexture(url);
  const { scene } = useThree();

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
    return () => {
      scene.background = null;
    };
  }, [scene, texture]);

  return null;
}
