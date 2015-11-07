/* global THREE */

// import TWEEN from 'tween.js'

import Config from './config'
import DeformableFaceGeometry from './deformable-face-geometry'


export default class FaceController extends THREE.Object3D {

  constructor(data, webcam) {
    super()

    this.enabled = true
    this.data = data
    this.webcam = webcam

    this.main = new THREE.Mesh(new DeformableFaceGeometry(), new THREE.MeshBasicMaterial({wireframe: true, transparent: true, opacity: 0.3}))
    this.main.matrixAutoUpdate = false
    this.add(this.main)

    this.alts = []
    for (let i =0; i < this.data.user_alt.property.length; i++) {
      let alt = new THREE.Mesh(new DeformableFaceGeometry())
      alt.visible = false
      this.add(alt)
      this.alts.push(alt)
    }

    this.smalls = []
    for (let i = 0; i < this.data.user_children.property.length; i++) {
      let small = new THREE.Mesh(new DeformableFaceGeometry())
      small.visible = false
      this.add(small)
      this.smalls.push(small)
    }

    this.update = this._followWebcam.bind(this)

    if (Config.DEV_MODE) {
      this.main.add(new THREE.AxisHelper())
      this.alts.forEach((face) => face.add(new THREE.AxisHelper()))
      this.smalls.forEach((face) => face.add(new THREE.AxisHelper()))
    }
  }


  captureWebcam() {
    this.main.geometry.init(this.webcam.rawFeaturePoints, 320, 180, this.webcam.scale.y)

    this.main.material = new THREE.ShaderMaterial({
      uniforms: {
        map: {type: 't', value: this.webcam.texture.clone()}
      },
      vertexShader: require('./shaders/face.vert'),
      fragmentShader: require('./shaders/face.frag'),
      side: THREE.DoubleSide
    })

    let position = new THREE.Vector3()
    let quaternion = new THREE.Quaternion()
    let scale = new THREE.Vector3()
    this.main.matrix.decompose(position, quaternion, scale)
    this.initialTransform = {position, quaternion, scale}
    this.main.matrixAutoUpdate = true

    this.alts.forEach((face) => {
      face.geometry.positionAttribute.copy(this.main.geometry.positionAttribute)
      face.geometry.uvAttribute.copy(this.main.geometry.uvAttribute)
      face.geometry.uvAttribute.needsUpdate = true
      face.material = this.main.material
    })
    this.smalls.forEach((face) => {
      face.geometry.positionAttribute.copy(this.main.geometry.positionAttribute)
      face.geometry.uvAttribute.copy(this.main.geometry.uvAttribute)
      face.geometry.uvAttribute.needsUpdate = true
      face.material = this.main.material
    })

    this.update = this._update.bind(this)
  }


  _followWebcam() {
    if (this.webcam.normalizedFeaturePoints) {
      this.main.geometry.deform(this.webcam.normalizedFeaturePoints)
      this.main.matrix.copy(this.webcam.matrixFeaturePoints)
    }
  }


  _update(currentFrame) {
    // intro
    {
      let f = Math.max(this.data.i_extra.in_frame, Math.min(this.data.i_extra.out_frame, currentFrame))
      let scaleZ = this.data.i_extra.property.scale_z[f]

      f = Math.max(this.data.user.in_frame, Math.min(this.data.user.out_frame, currentFrame))
      let props = this.data.user.property
      this.main.geometry.applyMorph(props.morph[f])

      let i = f * 3
      this.main.position.set(props.position[i], props.position[i + 1], props.position[i + 2])
      this.main.scale.set(props.scale[i] * 150, props.scale[i + 1] * 150, props.scale[i + 2] * 150 * scaleZ)
      i = f * 4
      this.main.quaternion.set(props.quaternion[i], props.quaternion[i + 1], props.quaternion[i + 2], props.quaternion[i + 3]).normalize()

      // transition from captured position to keyframes'
      f = Math.max(this.data.i_extra.in_frame, Math.min(this.data.i_extra.out_frame, currentFrame))
      let blend = 1 - this.data.i_extra.property.interpolation[f]
      if (blend > 0) {
        this.main.position.lerp(this.initialTransform.position, blend)
        this.main.scale.lerp(this.initialTransform.scale, blend)
        this.main.quaternion.slerp(this.initialTransform.quaternion, blend)
      }
    }

    // alts
    {
      if (this.data.user_alt.in_frame <= currentFrame && currentFrame <= this.data.user_alt.out_frame) {
        let f = currentFrame - this.data.user_alt.in_frame
        this.data.user_alt.property.forEach((props, i) => {
          let face = this.alts[i]
          face.visible = props.enabled[f]
          if (face.visible) {
            let j = f * 3
            face.position.set(props.position[j], props.position[j + 1], props.position[j + 2])
            face.scale.set(props.scale[j] * 150, props.scale[j + 1] * 150, props.scale[j + 2] * 150)
            j = f * 4
            face.quaternion.set(props.quaternion[j], props.quaternion[j + 1], props.quaternion[j + 2], props.quaternion[j + 3])
          }
        })
      }
    }

    // spawn children
    {
      if (this.data.user_children.in_frame <= currentFrame && currentFrame <= this.data.user_children.out_frame) {
        let f = currentFrame - this.data.user_children.in_frame
        this.data.user_children.property.forEach((props, i) => {
          let face = this.smalls[i]
          face.visible = props.enabled[f]
          if (face.visible) {
            let j = f * 3
            face.position.set(props.position[j], props.position[j + 1], props.position[j + 2])
            face.scale.set(props.scale[j] * 150, props.scale[j + 1] * 150, props.scale[j + 2] * 150)
            j = f * 4
            face.quaternion.set(props.quaternion[j], props.quaternion[j + 1], props.quaternion[j + 2], props.quaternion[j + 3])
          }
        })
      }
    }
  }

}