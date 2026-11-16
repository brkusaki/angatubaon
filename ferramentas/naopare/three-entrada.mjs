/* Entrada do pacote Three.js do Não Pare (Jogos/vendor/three-naopare.min.js).
   Só as peças que Jogos/naopare.js usa, para o arquivo ficar menor.
   Regerar (precisa do pacote "three" instalado em /tmp ou node_modules):
     npx esbuild ferramentas/naopare/three-entrada.mjs --bundle --minify \
       --format=iife --target=es2018 --outfile=Jogos/vendor/three-naopare.min.js
   Faltou uma classe? Acrescente aqui e regere. */
import {
  Scene, PerspectiveCamera, OrthographicCamera, WebGLRenderer, WebGLRenderTarget,
  Color, FogExp2, HemisphereLight, DirectionalLight, SpotLight, PointLight,
  Mesh, InstancedMesh, Group, Object3D, Points, Sprite, LineSegments,
  BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, DodecahedronGeometry,
  PlaneGeometry, SphereGeometry, CapsuleGeometry, TorusGeometry, BufferGeometry,
  BufferAttribute, Float32BufferAttribute, InstancedBufferAttribute, HalfFloatType,
  MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, PointsMaterial,
  ShaderMaterial, SpriteMaterial, LineBasicMaterial,
  CanvasTexture, RepeatWrapping, ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter,
  SRGBColorSpace, ACESFilmicToneMapping, AdditiveBlending, NormalBlending, DoubleSide, BackSide,
  Vector2, Vector3, Vector4, Matrix4, Quaternion, Euler, MathUtils, Sphere
  , PMREMGenerator, TextureLoader, EquirectangularReflectionMapping, AnimationMixer, LoopRepeat, LoopOnce,
  MeshPhysicalMaterial, PCFSoftShadowMap, SkinnedMesh, Box3
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
window.NPTHREE = {
  Scene, PerspectiveCamera, OrthographicCamera, WebGLRenderer, WebGLRenderTarget,
  Color, FogExp2, HemisphereLight, DirectionalLight, SpotLight, PointLight,
  Mesh, InstancedMesh, Group, Object3D, Points, Sprite, LineSegments,
  BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, DodecahedronGeometry,
  PlaneGeometry, SphereGeometry, CapsuleGeometry, TorusGeometry, BufferGeometry,
  BufferAttribute, Float32BufferAttribute, InstancedBufferAttribute, HalfFloatType,
  MeshLambertMaterial, MeshStandardMaterial, MeshBasicMaterial, PointsMaterial,
  ShaderMaterial, SpriteMaterial, LineBasicMaterial,
  CanvasTexture, RepeatWrapping, ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter,
  SRGBColorSpace, ACESFilmicToneMapping, AdditiveBlending, NormalBlending, DoubleSide, BackSide,
  Vector2, Vector3, Vector4, Matrix4, Quaternion, Euler, MathUtils, Sphere,
  PMREMGenerator, TextureLoader, EquirectangularReflectionMapping, AnimationMixer, LoopRepeat, LoopOnce,
  MeshPhysicalMaterial, PCFSoftShadowMap, SkinnedMesh, Box3, GLTFLoader
};
