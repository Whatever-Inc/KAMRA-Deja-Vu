// import shaders
const GRID_VERT_SHADER = require("../shaders/grid_vert.glsl");
const GRID_FRAG_SHADER = require("../shaders/grid_frag.glsl");
const FACE_VERT_SHADER = require("../shaders/face_vert.glsl");
const FACE_FRAG_SHADER = require("../shaders/face_frag.glsl");

const verticleData = require("./../vertice_data.js");

/**
 * FaceDeformer
 */
export default class Fukuwarai {

  /**
   * Init with weggl canvas
   * @param canvas
   */
  constructor(canvas) {
    this.gl = getWebGLContext(canvas);
    this.usegrid = false;
    this.verticeMap = verticleData.getAll();
    //this.verticeMap = verticleData.getEyes();
    this._mode = 0;

    // load shaders
    const gl = this.gl;
    const gridVertexShader = loadShader(gl, GRID_VERT_SHADER, gl.VERTEX_SHADER);
    const gridFragmentShader = loadShader(gl, GRID_FRAG_SHADER, gl.FRAGMENT_SHADER);
    this.gridProgram = createProgram(gl, [gridVertexShader, gridFragmentShader]);
    const vertexShader = loadShader(gl, FACE_VERT_SHADER, gl.VERTEX_SHADER);
    const fragmentShader = loadShader(gl, FACE_FRAG_SHADER, gl.FRAGMENT_SHADER);
    this.drawProgram = createProgram(gl, [vertexShader, fragmentShader]);
    this.gridCoordbuffer = gl.createBuffer();
    this.texCoordBuffer = gl.createBuffer();
  }

  setMode(mode) {
    if(this._mode == mode) {
      return;
    }
    if(mode == 0) {
      this.verticeMap = verticleData.getEyes();
    } else if(mode == 1) {
      this.verticeMap = verticleData.getMouth();
    } else {
      console.error(`No mode : ${mode}`);
    }
    this._mode = mode;
  }

  /**
   *
   * @param element
   * @param points
   * @param pModel
   * @param vertices
   */
  load(element, points) {
    let gl = this.gl;
    const verticeMap = this.verticeMap;

    // get cropping
    let maxx = 0;
    let minx = element.width;
    let maxy = 0;
    let miny = element.height;
    for (var i = 0;i < points.length;i++) {
      if (points[i][0] > maxx) maxx = points[i][0];
      if (points[i][0] < minx) minx = points[i][0];
      if (points[i][1] > maxy) maxy = points[i][1];
      if (points[i][1] < miny) miny = points[i][1];
    }
    minx = Math.floor(minx);
    maxx = Math.ceil(maxx);
    miny = Math.floor(miny);
    maxy = Math.ceil(maxy);
    const width = this.width = maxx-minx;
    const height = this.height = maxy-miny;
    const cc = element.getContext('2d');
    const image = cc.getImageData(minx, miny, width, height);

    // correct points
    const nupoints = [];
    for (let i = 0;i < points.length;i++) {
      nupoints[i] = [];
      nupoints[i][0] = points[i][0] - minx;
      nupoints[i][1] = points[i][1] - miny;
    }

    // create vertices based on points
    const textureVertices = [];
    for (let i = 0;i < verticeMap.length;i++) {
      textureVertices.push(nupoints[verticeMap[i][0]][0]/width);
      textureVertices.push(nupoints[verticeMap[i][0]][1]/height);
      textureVertices.push(nupoints[verticeMap[i][1]][0]/width);
      textureVertices.push(nupoints[verticeMap[i][1]][1]/height);
      textureVertices.push(nupoints[verticeMap[i][2]][0]/width);
      textureVertices.push(nupoints[verticeMap[i][2]][1]/height);
    }

    // load program for drawing grid
    gl.useProgram(this.gridProgram);

    // set the resolution for grid program
    let resolutionLocation = gl.getUniformLocation(this.gridProgram, "u_resolution");
    gl.uniform2f(resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);

    // load program for drawing deformed face
    gl.useProgram(this.drawProgram);

    // look up where the vertex data needs to go.
    this.texCoordLocation = gl.getAttribLocation(this.drawProgram, "a_texCoord");

    // provide texture coordinates for face vertices (i.e. where we're going to copy face vertices from).
    gl.enableVertexAttribArray(this.texCoordLocation);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureVertices), gl.STATIC_DRAW);

    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Create the texture.
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Upload the image into the texture.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // set the resolution for draw program
    resolutionLocation = gl.getUniformLocation(this.drawProgram, "u_resolution");
    gl.uniform2f(resolutionLocation, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  /**
   * Draw
   * @param points
   */
  draw(points) {
    const gl = this.gl;
    const verticeMap = this.verticeMap;

    if (this.usegrid) {
      // switch program if needed
      gl.useProgram(this.drawProgram);

      gl.enableVertexAttribArray(this.texCoordLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
      gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

      this.usegrid = false;
    }

    // create drawvertices based on points
    let vertices = [];
    for (var i = 0;i < this.verticeMap.length;i++) {
      vertices.push(points[verticeMap[i][0]][0]);
      vertices.push(points[verticeMap[i][0]][1]);
      vertices.push(points[verticeMap[i][1]][0]);
      vertices.push(points[verticeMap[i][1]][1]);
      vertices.push(points[verticeMap[i][2]][0]);
      vertices.push(points[verticeMap[i][2]][1]);
    }

    const positionLocation = gl.getAttribLocation(this.drawProgram, "a_position");

    // Create a buffer for the position of the vertices.
    const drawPosBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, drawPosBuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Draw the face vertices
    gl.drawArrays(gl.TRIANGLES, 0, verticeMap.length*3);
  }

  /**
   * Draw grid
   * @param points
   */
  drawGrid(points) {
    const gl = this.gl;
    const verticeMap = this.verticeMap;

    if (!this.usegrid) {
      gl.useProgram(this.gridProgram);
      this.usegrid = true;
    }

    // create drawvertices based on points

    let vertices = [];
    // create new texturegrid
    for (let i = 0;i < verticeMap.length;i++) {
      vertices.push(points[verticeMap[i][0]][0]);
      vertices.push(points[verticeMap[i][0]][1]);
      vertices.push(points[verticeMap[i][1]][0]);
      vertices.push(points[verticeMap[i][1]][1]);

      vertices.push(points[verticeMap[i][1]][0]);
      vertices.push(points[verticeMap[i][1]][1]);
      vertices.push(points[verticeMap[i][2]][0]);
      vertices.push(points[verticeMap[i][2]][1]);

      vertices.push(points[verticeMap[i][2]][0]);
      vertices.push(points[verticeMap[i][2]][1]);
      vertices.push(points[verticeMap[i][0]][0]);
      vertices.push(points[verticeMap[i][0]][1]);
    }

    const positionLocation = gl.getAttribLocation(this.gridProgram, "a_position");

    // Create a buffer for position of the vertices (lines)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.gridCoordbuffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    // Draw the lines
    gl.drawArrays(gl.LINES, 0, verticeMap.length*6);
  }

  /**
   * Clear
   */
  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }
}

