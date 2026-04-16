function fpsVec3(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function fpsVec3Add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function fpsVec3Sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function fpsVec3Scale(v, scalar) {
  return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
}

function fpsVec3Dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function fpsVec3Cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function fpsVec3Length(v) {
  return Math.hypot(v.x, v.y, v.z);
}

function fpsVec3Normalize(v) {
  const length = fpsVec3Length(v) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function fpsMat4Identity() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function fpsMat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    const b0 = b[column * 4 + 0];
    const b1 = b[column * 4 + 1];
    const b2 = b[column * 4 + 2];
    const b3 = b[column * 4 + 3];
    out[column * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[column * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[column * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[column * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

function fpsMat4Translation(x, y, z) {
  const out = fpsMat4Identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function fpsMat4Scale(x, y, z) {
  const out = fpsMat4Identity();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function fpsMat4RotateX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ]);
}

function fpsMat4RotateY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ]);
}

function fpsMat4RotateZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

function fpsMat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const out = new Float32Array(16);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

function fpsMat4LookAt(eye, target, up) {
  const zAxis = fpsVec3Normalize(fpsVec3Sub(eye, target));
  const xAxis = fpsVec3Normalize(fpsVec3Cross(up, zAxis));
  const yAxis = fpsVec3Cross(zAxis, xAxis);
  const out = fpsMat4Identity();

  out[0] = xAxis.x;
  out[1] = yAxis.x;
  out[2] = zAxis.x;
  out[4] = xAxis.y;
  out[5] = yAxis.y;
  out[6] = zAxis.y;
  out[8] = xAxis.z;
  out[9] = yAxis.z;
  out[10] = zAxis.z;
  out[12] = -fpsVec3Dot(xAxis, eye);
  out[13] = -fpsVec3Dot(yAxis, eye);
  out[14] = -fpsVec3Dot(zAxis, eye);
  return out;
}

function fpsMat3FromMat4(matrix) {
  return new Float32Array([
    matrix[0], matrix[1], matrix[2],
    matrix[4], matrix[5], matrix[6],
    matrix[8], matrix[9], matrix[10],
  ]);
}

function fpsMat4FromQuaternion(quaternion) {
  const [x, y, z, w] = quaternion;
  const x2 = x + x;
  const y2 = y + y;
  const z2 = z + z;
  const xx = x * x2;
  const xy = x * y2;
  const xz = x * z2;
  const yy = y * y2;
  const yz = y * z2;
  const zz = z * z2;
  const wx = w * x2;
  const wy = w * y2;
  const wz = w * z2;

  return new Float32Array([
    1 - (yy + zz), xy + wz, xz - wy, 0,
    xy - wz, 1 - (xx + zz), yz + wx, 0,
    xz + wy, yz - wx, 1 - (xx + yy), 0,
    0, 0, 0, 1,
  ]);
}

function fpsComposeMatrix(translation = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]) {
  const translationMatrix = fpsMat4Translation(translation[0], translation[1], translation[2]);
  const rotationMatrix = fpsMat4FromQuaternion(rotation);
  const scaleMatrix = fpsMat4Scale(scale[0], scale[1], scale[2]);
  return fpsMat4Multiply(translationMatrix, fpsMat4Multiply(rotationMatrix, scaleMatrix));
}

function fpsDecodeBase64Bytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function fpsAccessorComponentCount(type) {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    default:
      throw new Error(`Unsupported accessor type: ${type}`);
  }
}

function fpsComponentBytes(componentType) {
  switch (componentType) {
    case 5120:
    case 5121:
      return 1;
    case 5122:
    case 5123:
      return 2;
    case 5125:
    case 5126:
      return 4;
    default:
      throw new Error(`Unsupported component type: ${componentType}`);
  }
}

function fpsReadComponent(dataView, componentType, offset) {
  switch (componentType) {
    case 5120:
      return dataView.getInt8(offset);
    case 5121:
      return dataView.getUint8(offset);
    case 5122:
      return dataView.getInt16(offset, true);
    case 5123:
      return dataView.getUint16(offset, true);
    case 5125:
      return dataView.getUint32(offset, true);
    case 5126:
      return dataView.getFloat32(offset, true);
    default:
      throw new Error(`Unsupported component type: ${componentType}`);
  }
}

function fpsReadAccessor(json, binChunk, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const componentCount = fpsAccessorComponentCount(accessor.type);
  const bytesPerComponent = fpsComponentBytes(accessor.componentType);
  const stride = bufferView.byteStride || componentCount * bytesPerComponent;
  const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
  const itemCount = accessor.count;
  const totalValues = itemCount * componentCount;
  const dataView = new DataView(binChunk.buffer, binChunk.byteOffset + start, stride * itemCount);
  let array;

  if (accessor.componentType === 5126) {
    array = new Float32Array(totalValues);
  } else if (accessor.componentType === 5125) {
    array = new Uint32Array(totalValues);
  } else if (accessor.componentType === 5123) {
    array = new Uint16Array(totalValues);
  } else if (accessor.componentType === 5121) {
    array = new Uint8Array(totalValues);
  } else {
    array = new Float32Array(totalValues);
  }

  for (let item = 0; item < itemCount; item += 1) {
    const rowOffset = item * stride;
    for (let component = 0; component < componentCount; component += 1) {
      array[item * componentCount + component] = fpsReadComponent(
        dataView,
        accessor.componentType,
        rowOffset + component * bytesPerComponent,
      );
    }
  }

  return {
    array,
    count: itemCount,
    componentType: accessor.componentType,
    componentCount,
  };
}

function fpsCreateSequentialIndices(vertexCount) {
  const array = new Uint32Array(vertexCount);
  for (let index = 0; index < vertexCount; index += 1) {
    array[index] = index;
  }
  return array;
}

function fpsCreateBitmap(blob) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

async function loadDragonLoreModelData() {
  if (loadDragonLoreModelData.cache) {
    return loadDragonLoreModelData.cache;
  }

  loadDragonLoreModelData.cache = (async () => {
    const base64 = window.DRAGON_LORE_GLB_BASE64;
    if (!base64) {
      throw new Error("Dragon Lore 模型资源不存在");
    }

    const bytes = fpsDecodeBase64Bytes(base64);
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== "glTF") {
      throw new Error("GLB 文件头无效");
    }

    const totalLength = header.getUint32(8, true);
    let offset = 12;
    let json = null;
    let binChunk = null;

    while (offset < totalLength) {
      const chunkLength = header.getUint32(offset, true);
      const chunkType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      const chunkStart = offset + 8;
      const chunkEnd = chunkStart + chunkLength;

      if (chunkType === "JSON") {
        const text = new TextDecoder().decode(bytes.slice(chunkStart, chunkEnd)).replace(/\0+$/, "").trim();
        json = JSON.parse(text);
      } else if (chunkType.startsWith("BIN")) {
        binChunk = bytes.slice(chunkStart, chunkEnd);
      }

      offset = chunkEnd;
    }

    if (!json || !binChunk) {
      throw new Error("GLB 缺少 JSON 或 BIN 数据块");
    }

    const imageBitmaps = await Promise.all((json.images || []).map(async (imageDef) => {
      if (imageDef.bufferView === undefined) {
        return null;
      }
      const bufferView = json.bufferViews[imageDef.bufferView];
      const start = bufferView.byteOffset || 0;
      const end = start + bufferView.byteLength;
      const blob = new Blob([binChunk.slice(start, end)], { type: imageDef.mimeType || "image/png" });
      return fpsCreateBitmap(blob);
    }));

    const textures = (json.textures || []).map((textureDef) => imageBitmaps[textureDef.source] || null);
    const materials = (json.materials || []).map((materialDef) => {
      const pbr = materialDef.pbrMetallicRoughness || {};
      return {
        baseColorFactor: pbr.baseColorFactor || [1, 1, 1, 1],
        textureBitmap: pbr.baseColorTexture ? textures[pbr.baseColorTexture.index] : null,
      };
    });

    const nodes = json.nodes || [];
    const nodeWorldMatrices = new Array(nodes.length).fill(null);
    const scene = (json.scenes || [])[json.scene || 0] || { nodes: [] };

    function walkNode(nodeIndex, parentMatrix) {
      const node = nodes[nodeIndex];
      if (!node) {
        return;
      }
      const localMatrix = node.matrix
        ? new Float32Array(node.matrix)
        : fpsComposeMatrix(node.translation, node.rotation, node.scale);
      const worldMatrix = fpsMat4Multiply(parentMatrix, localMatrix);
      nodeWorldMatrices[nodeIndex] = worldMatrix;
      (node.children || []).forEach((childIndex) => walkNode(childIndex, worldMatrix));
    }

    (scene.nodes || []).forEach((rootNodeIndex) => walkNode(rootNodeIndex, fpsMat4Identity()));

    const meshes = json.meshes || [];
    const weaponPrimitives = [];
    const decorPrimitives = [];

    nodes.forEach((node, nodeIndex) => {
      if (node.mesh === undefined || !nodeWorldMatrices[nodeIndex]) {
        return;
      }

      const meshDef = meshes[node.mesh];
      const bucket = /sphere/i.test(`${node.name || ""} ${meshDef.name || ""}`) ? decorPrimitives : weaponPrimitives;

      (meshDef.primitives || []).forEach((primitiveDef, primitiveIndex) => {
        const positions = fpsReadAccessor(json, binChunk, primitiveDef.attributes.POSITION);
        const normals = primitiveDef.attributes.NORMAL !== undefined
          ? fpsReadAccessor(json, binChunk, primitiveDef.attributes.NORMAL)
          : null;
        const uvs = primitiveDef.attributes.TEXCOORD_0 !== undefined
          ? fpsReadAccessor(json, binChunk, primitiveDef.attributes.TEXCOORD_0)
          : null;
        const indices = primitiveDef.indices !== undefined
          ? fpsReadAccessor(json, binChunk, primitiveDef.indices)
          : null;

        bucket.push({
          name: `${meshDef.name || "mesh"}-${primitiveIndex}`,
          positions: positions.array,
          normals: normals ? normals.array : new Float32Array(positions.count * 3),
          uvs: uvs ? uvs.array : new Float32Array(positions.count * 2),
          indices: indices ? indices.array : fpsCreateSequentialIndices(positions.count),
          material: materials[primitiveDef.material] || { baseColorFactor: [1, 1, 1, 1], textureBitmap: null },
          modelMatrix: nodeWorldMatrices[nodeIndex],
        });
      });
    });

    return { weaponPrimitives, decorPrimitives };
  })();

  return loadDragonLoreModelData.cache;
}

function fpsCreateShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(log || "Shader compile failed");
  }
  return shader;
}

function fpsCreateProgram(gl, vertexSource, fragmentSource, attributeBindings = null) {
  const vertexShader = fpsCreateShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = fpsCreateShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  if (attributeBindings) {
    Object.entries(attributeBindings).forEach(([name, location]) => {
      gl.bindAttribLocation(program, location, name);
    });
  }
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(log || "Program link failed");
  }
  return program;
}

function fpsCreateRendererContext(canvas) {
  const contextOptions = { antialias: true, alpha: false };
  let gl = canvas.getContext("webgl2", contextOptions);
  if (gl) {
    return {
      gl,
      isWebGL2: true,
      hasDerivatives: true,
    };
  }

  gl = canvas.getContext("webgl", contextOptions) || canvas.getContext("experimental-webgl", contextOptions);
  if (!gl) {
    return {
      gl: null,
      isWebGL2: false,
      hasDerivatives: false,
    };
  }

  return {
    gl,
    isWebGL2: false,
    hasDerivatives: Boolean(gl.getExtension("OES_standard_derivatives")),
  };
}

function fpsIndexType(gl, array) {
  if (array instanceof Uint32Array) {
    return gl.UNSIGNED_INT;
  }
  if (array instanceof Uint16Array) {
    return gl.UNSIGNED_SHORT;
  }
  return gl.UNSIGNED_BYTE;
}

function fpsNormalizeIndexArray(array) {
  if (!(array instanceof Uint32Array)) {
    return array;
  }
  let max = 0;
  for (let index = 0; index < array.length; index += 1) {
    if (array[index] > max) {
      max = array[index];
    }
  }
  if (max <= 65535) {
    return new Uint16Array(array);
  }
  return array;
}

function fpsIsPowerOfTwo(value) {
  return value > 0 && (value & (value - 1)) === 0;
}

function fpsCreateSolidTexture(gl, rgba) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
  return texture;
}

function fpsCreateBitmapTexture(gl, bitmap, renderer = { isWebGL2: true }) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const width = bitmap.width || bitmap.videoWidth || bitmap.naturalWidth || 0;
  const height = bitmap.height || bitmap.videoHeight || bitmap.naturalHeight || 0;
  const canRepeat = renderer.isWebGL2 || (fpsIsPowerOfTwo(width) && fpsIsPowerOfTwo(height));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, canRepeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, canRepeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, canRepeat ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
  if (canRepeat) {
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  return texture;
}

function fpsCreateMeshResource(gl, programInfo, primitive, renderer = { isWebGL2: true }) {
  const indices = fpsNormalizeIndexArray(primitive.indices);
  const vao = renderer.isWebGL2 ? gl.createVertexArray() : null;
  if (vao) {
    gl.bindVertexArray(vao);
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, primitive.positions, gl.STATIC_DRAW);
  if (vao) {
    gl.enableVertexAttribArray(programInfo.attributes.position);
    gl.vertexAttribPointer(programInfo.attributes.position, 3, gl.FLOAT, false, 0, 0);
  }

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, primitive.normals, gl.STATIC_DRAW);
  if (vao) {
    gl.enableVertexAttribArray(programInfo.attributes.normal);
    gl.vertexAttribPointer(programInfo.attributes.normal, 3, gl.FLOAT, false, 0, 0);
  }

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, primitive.uvs, gl.STATIC_DRAW);
  if (vao) {
    gl.enableVertexAttribArray(programInfo.attributes.uv);
    gl.vertexAttribPointer(programInfo.attributes.uv, 2, gl.FLOAT, false, 0, 0);
  }

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  if (vao) {
    gl.bindVertexArray(null);
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  return {
    vao,
    count: indices.length,
    indexType: fpsIndexType(gl, indices),
    positionBuffer,
    normalBuffer,
    uvBuffer,
    indexBuffer,
    buffers: [positionBuffer, normalBuffer, uvBuffer, indexBuffer],
  };
}

function fpsCreatePlanePrimitive() {
  return {
    positions: new Float32Array([
      -0.5, 0, -0.5,
      0.5, 0, -0.5,
      0.5, 0, 0.5,
      -0.5, 0, 0.5,
    ]),
    normals: new Float32Array([
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
      0, 1, 0,
    ]),
    uvs: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1,
    ]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

function fpsCreateCubePrimitive() {
  return {
    positions: new Float32Array([
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
      -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
      0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
      -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    ]),
    normals: new Float32Array([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
      -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    ]),
    uvs: new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
    ]),
    indices: new Uint16Array([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23,
    ]),
  };
}

function fpsCreateSpherePrimitive(latSegments = 10, lonSegments = 14) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  for (let lat = 0; lat <= latSegments; lat += 1) {
    const v = lat / latSegments;
    const phi = v * Math.PI;
    const y = Math.cos(phi);
    const ringRadius = Math.sin(phi);

    for (let lon = 0; lon <= lonSegments; lon += 1) {
      const u = lon / lonSegments;
      const theta = u * Math.PI * 2;
      const x = Math.cos(theta) * ringRadius;
      const z = Math.sin(theta) * ringRadius;
      positions.push(x, y, z);
      normals.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const stride = lonSegments + 1;
  for (let lat = 0; lat < latSegments; lat += 1) {
    for (let lon = 0; lon < lonSegments; lon += 1) {
      const a = lat * stride + lon;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

function fpsRaySphere(origin, direction, center, radius) {
  const offset = fpsVec3Sub(origin, center);
  const a = fpsVec3Dot(direction, direction);
  const b = 2 * fpsVec3Dot(offset, direction);
  const c = fpsVec3Dot(offset, offset) - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) {
    return null;
  }
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  if (t1 > 0) {
    return t1;
  }
  if (t2 > 0) {
    return t2;
  }
  return null;
}

function mountDragonLoreFPSCanvas(host, options = {}) {
  const disposer = createDisposer();
  const { shell, playfield, panel, canvas, ctx, notice } = createGameLayout(host, {
    canvas: true,
    width: 1600,
    height: 900,
  });

  shell.classList.add("fps-shell");
  playfield.classList.add("fps-playfield");
  panel.classList.add("fps-panel");
  canvas.classList.add("fps-canvas");

  if (!ctx) {
    panel.append(el("p", "inline-help", "当前浏览器连 2D 画布也不可用。"));
    notice.textContent = "Canvas 不可用";
    notice.classList.add("visible");
    return () => disposer.destroy();
  }

  const scoreRefs = createScoreStrip(panel, [
    { key: "health", label: "血量", value: "100" },
    { key: "ammo", label: "子弹", value: "5 / 25" },
    { key: "wave", label: "波次", value: "1 / 5" },
    { key: "kills", label: "击杀", value: "0" },
  ]);

  const actionRow = el("div", "tool-row fps-tools");
  const aimButton = el("button", "small-button", "激活瞄准");
  const fullscreenButton = el("button", "small-button", "全屏作战");
  actionRow.append(aimButton, fullscreenButton);
  panel.append(actionRow);

  const minimapSection = el("section", "");
  minimapSection.append(el("h4", "", "战术雷达"));
  const minimapCanvas = document.createElement("canvas");
  minimapCanvas.width = 220;
  minimapCanvas.height = 220;
  minimapCanvas.className = "fps-minimap";
  minimapSection.append(minimapCanvas);
  panel.append(minimapSection);
  const minimapCtx = minimapCanvas.getContext("2d");

  const feedSection = el("section", "");
  feedSection.append(el("h4", "", "战况播报"));
  const feedList = el("div", "fps-feed");
  feedSection.append(feedList);
  panel.append(feedSection);

  addPanelText(panel, "模式", "Safari 兼容版第一人称射击。场景改用 <strong>Canvas</strong> 射线投影，枪身仍然读取 <strong>Dragon Lore</strong> 模型贴图。");
  addPanelList(panel, "操作", [
    "鼠标移到画面里左右移动来转向。",
    "WASD 移动，左键或 Space 开火，R 换弹。",
    "F 或双击画面全屏，Safari 下不再强依赖鼠标锁定。",
  ]);

  const hud = el("div", "fps-hud");
  hud.innerHTML = `
    <div class="fps-banner">
      <span class="mini-label">DRAGON LORE OPS</span>
      <strong>Safari 兼容战场已接管</strong>
      <span class="fps-subtitle">Canvas Raycast FPS + Dragon Lore 贴图</span>
    </div>
    <div class="fps-crosshair" aria-hidden="true"></div>
    <div class="fps-bottom-bar">
      <div>
        <span>目标</span>
        <strong id="fpsObjective">清空第 1 波敌人</strong>
      </div>
      <div>
        <span>最佳记录</span>
        <strong id="fpsBest">0 击杀 / W1</strong>
      </div>
    </div>
    <div class="fps-hit-overlay"></div>
  `;
  playfield.append(hud);

  const objectiveEl = hud.querySelector("#fpsObjective");
  const bestEl = hud.querySelector("#fpsBest");
  const hitOverlay = hud.querySelector(".fps-hit-overlay");

  const storageKey = "dragon-lore-fps-best";
  const bestRecord = safeGet(storageKey, { kills: 0, wave: 1 });
  bestEl.textContent = `${bestRecord.kills} 击杀 / W${bestRecord.wave}`;

  const mapRows = [
    "################",
    "#......#.......#",
    "#..##..#..##...#",
    "#..............#",
    "#..#..####..#..#",
    "#..............#",
    "#..##......##..#",
    "#......##......#",
    "#..#........#..#",
    "#......##......#",
    "#..##......##..#",
    "#..............#",
    "#..#..####..#..#",
    "#..............#",
    "#......#.......#",
    "################",
  ];
  const mapSize = mapRows.length;
  const freeCells = [];
  mapRows.forEach((row, y) => {
    row.split("").forEach((cell, x) => {
      if (cell !== "#") {
        freeCells.push({ x: x + 0.5, y: y + 0.5 });
      }
    });
  });

  const player = {
    x: 2.5,
    y: 2.5,
    angle: 0.15,
    radius: 0.24,
    health: 100,
    clip: 5,
    reserve: 25,
    reload: 0,
    cooldown: 0,
    sprint: 1,
    kills: 0,
    dead: false,
    victorious: false,
    hitFlash: 0,
    gunKick: 0,
  };

  const state = {
    wave: 1,
    maxWave: 5,
    enemies: [],
    effects: [],
    projectiles: [],
    betweenWaveTimer: 0.8,
    hoverActive: false,
    mouseTurn: 0,
    fireHeld: false,
    started: false,
  };

  const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  };

  let noticeTimer = 0;
  const feeds = [];
  let weaponPattern = null;
  let weaponBitmap = null;

  function showNotice(message, duration = 1800) {
    notice.textContent = message;
    notice.classList.add("visible");
    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => notice.classList.remove("visible"), duration);
  }

  function pushFeed(message) {
    feeds.unshift(message);
    if (feeds.length > 6) feeds.length = 6;
    feedList.innerHTML = feeds.map((line) => `<div class="fps-feed-line">${line}</div>`).join("");
  }

  function normAngle(angle) {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
  }

  function isWall(x, y) {
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    if (cellX < 0 || cellY < 0 || cellX >= mapSize || cellY >= mapSize) return true;
    return mapRows[cellY][cellX] === "#";
  }

  function castRay(angle, maxDistance = 20, step = 0.035) {
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let x = player.x;
    let y = player.y;
    let distanceTravelled = 0;
    while (distanceTravelled < maxDistance) {
      x += dx;
      y += dy;
      distanceTravelled += step;
      if (isWall(x, y)) {
        return { distance: distanceTravelled, hitX: x, hitY: y };
      }
    }
    return { distance: maxDistance, hitX: x, hitY: y };
  }

  function findSpawnPoint(avoidPlayer = true) {
    const pool = avoidPlayer
      ? freeCells.filter((cell) => distance(cell.x, cell.y, player.x, player.y) > 5)
      : freeCells;
    return choice(pool.length ? pool : freeCells);
  }

  function spawnWave() {
    const count = 3 + state.wave * 2;
    state.enemies = Array.from({ length: count }, (_, index) => {
      const spawn = findSpawnPoint(true);
      return {
        id: `${state.wave}-${index}-${Math.random().toString(16).slice(2, 8)}`,
        x: spawn.x,
        y: spawn.y,
        radius: rand(0.28, 0.4),
        health: 65 + state.wave * 20,
        maxHealth: 65 + state.wave * 20,
        speed: 1.05 + state.wave * 0.12,
        shootCooldown: rand(0.8, 1.5),
        hitFlash: 0,
      };
    });
    state.projectiles.length = 0;
    pushFeed(`第 ${state.wave} 波开始：${count} 个目标`);
    showNotice(`第 ${state.wave} 波开战`, 1500);
  }

  function updateBestRecord() {
    if (player.kills > bestRecord.kills || (player.kills === bestRecord.kills && state.wave > bestRecord.wave)) {
      bestRecord.kills = player.kills;
      bestRecord.wave = state.wave;
      safeSet(storageKey, bestRecord);
      bestEl.textContent = `${bestRecord.kills} 击杀 / W${bestRecord.wave}`;
    }
  }

  function updateHud() {
    scoreRefs.health.textContent = String(Math.max(0, Math.ceil(player.health)));
    scoreRefs.ammo.textContent = `${player.clip} / ${player.reserve}`;
    scoreRefs.wave.textContent = `${Math.min(state.wave, state.maxWave)} / ${state.maxWave}`;
    scoreRefs.kills.textContent = String(player.kills);
    objectiveEl.textContent = player.victorious
      ? "Safari 兼容版已清场"
      : player.dead
        ? "已倒下，点重新开始再来"
        : `清空第 ${Math.min(state.wave, state.maxWave)} 波敌人`;
    hitOverlay.style.opacity = String(clamp(player.hitFlash, 0, 1));
  }

  function attemptMove(nextX, nextY) {
    if (!isWall(nextX, player.y)) player.x = nextX;
    if (!isWall(player.x, nextY)) player.y = nextY;
  }

  function canEnemySeePlayer(enemy) {
    const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const dx = Math.cos(angleToPlayer) * 0.06;
    const dy = Math.sin(angleToPlayer) * 0.06;
    let x = enemy.x;
    let y = enemy.y;
    let travelled = 0;
    const targetDistance = distance(enemy.x, enemy.y, player.x, player.y);
    while (travelled < targetDistance) {
      x += dx;
      y += dy;
      travelled += 0.06;
      if (isWall(x, y)) return false;
    }
    return true;
  }

  function damagePlayer(amount) {
    if (player.dead || player.victorious) return;
    player.health = clamp(player.health - amount, 0, 100);
    player.hitFlash = 0.75;
    pushFeed(`你受到 ${Math.ceil(amount)} 伤害`);
    if (player.health <= 0) {
      player.dead = true;
      showNotice("你被击倒了", 2200);
      pushFeed("本局失败，等待重开");
      updateBestRecord();
    }
  }

  function fireWeapon() {
    if (player.dead || player.victorious || player.reload > 0 || player.cooldown > 0) return;
    if (player.clip <= 0) {
      if (player.reserve > 0) {
        player.reload = 1.2;
        showNotice("换弹中", 900);
        pushFeed("开始换弹");
      } else {
        showNotice("子弹打空了", 1000);
      }
      return;
    }

    player.clip -= 1;
    player.cooldown = 0.34;
    player.gunKick = 1;

    let bestTarget = null;
    state.enemies.forEach((enemy) => {
      const angleToEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      const diff = Math.abs(normAngle(angleToEnemy - player.angle));
      const dist = distance(player.x, player.y, enemy.x, enemy.y);
      const rayHit = castRay(angleToEnemy, dist + 0.2);
      const clearSight = rayHit.distance >= dist - 0.08;
      if (diff < 0.11 && clearSight) {
        if (!bestTarget || dist < bestTarget.dist) {
          bestTarget = { enemy, dist };
        }
      }
    });

    if (bestTarget) {
      const damage = 95 + state.wave * 9;
      bestTarget.enemy.health -= damage;
      bestTarget.enemy.hitFlash = 1;
      state.effects.push({ type: "hit", x: bestTarget.enemy.x, y: bestTarget.enemy.y, life: 0.25 });
      pushFeed(`龙狙命中 ${Math.ceil(damage)} 伤害`);
      if (bestTarget.enemy.health <= 0) {
        state.enemies = state.enemies.filter((enemy) => enemy !== bestTarget.enemy);
        player.kills += 1;
        player.reserve = clamp(player.reserve + 1, 0, 40);
        showNotice("命中清除", 900);
        pushFeed(`一枪带走，当前 ${player.kills} 击杀`);
        updateBestRecord();
      }
    } else {
      state.effects.push({ type: "miss", x: player.x + Math.cos(player.angle) * 3.5, y: player.y + Math.sin(player.angle) * 3.5, life: 0.15 });
    }
  }

  function updatePlayer(dt) {
    if (!player.dead && !player.victorious) {
      player.angle = normAngle(player.angle + state.mouseTurn * dt * 2.8);
      let moveX = 0;
      let moveY = 0;
      const forwardX = Math.cos(player.angle);
      const forwardY = Math.sin(player.angle);
      const rightX = Math.cos(player.angle + Math.PI / 2);
      const rightY = Math.sin(player.angle + Math.PI / 2);
      if (input.forward) { moveX += forwardX; moveY += forwardY; }
      if (input.backward) { moveX -= forwardX; moveY -= forwardY; }
      if (input.left) { moveX -= rightX; moveY -= rightY; }
      if (input.right) { moveX += rightX; moveY += rightY; }
      const length = Math.hypot(moveX, moveY);
      if (length > 0) {
        moveX /= length;
        moveY /= length;
        const sprinting = input.sprint && player.sprint > 0.1;
        const speed = sprinting ? 3.3 : 2.2;
        if (sprinting) {
          player.sprint = Math.max(0, player.sprint - dt * 0.35);
        } else {
          player.sprint = Math.min(1, player.sprint + dt * 0.22);
        }
        attemptMove(player.x + moveX * speed * dt, player.y + moveY * speed * dt);
      } else {
        player.sprint = Math.min(1, player.sprint + dt * 0.24);
      }
      if (state.fireHeld) fireWeapon();
    }

    player.cooldown = Math.max(0, player.cooldown - dt);
    player.gunKick = Math.max(0, player.gunKick - dt * 5.5);
    player.hitFlash = Math.max(0, player.hitFlash - dt * 1.8);
    if (player.reload > 0) {
      player.reload = Math.max(0, player.reload - dt);
      if (player.reload === 0) {
        const refill = Math.min(5 - player.clip, player.reserve);
        player.clip += refill;
        player.reserve -= refill;
        pushFeed(`换弹完成，装入 ${refill} 发`);
      }
    }
  }

  function updateEnemies(dt) {
    if (player.dead || player.victorious) return;
    state.enemies.forEach((enemy) => {
      const angleToPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      const dist = distance(enemy.x, enemy.y, player.x, player.y);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 4.4);
      if (dist > 0.75) {
        const speed = enemy.speed * dt;
        const nextX = enemy.x + Math.cos(angleToPlayer) * speed;
        const nextY = enemy.y + Math.sin(angleToPlayer) * speed;
        if (!isWall(nextX, enemy.y)) enemy.x = nextX;
        if (!isWall(enemy.x, nextY)) enemy.y = nextY;
      } else {
        damagePlayer(18 * dt);
      }

      enemy.shootCooldown -= dt;
      if (enemy.shootCooldown <= 0 && dist < 8 && canEnemySeePlayer(enemy)) {
        state.projectiles.push({
          x: enemy.x,
          y: enemy.y,
          dx: Math.cos(angleToPlayer) * (2.7 + state.wave * 0.1),
          dy: Math.sin(angleToPlayer) * (2.7 + state.wave * 0.1),
          life: 2.5,
        });
        enemy.shootCooldown = rand(0.8, 1.4);
      }
    });
  }

  function updateProjectiles(dt) {
    for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
      const shot = state.projectiles[index];
      shot.x += shot.dx * dt;
      shot.y += shot.dy * dt;
      shot.life -= dt;
      if (isWall(shot.x, shot.y) || shot.life <= 0) {
        state.projectiles.splice(index, 1);
        continue;
      }
      if (distance(shot.x, shot.y, player.x, player.y) < 0.28) {
        damagePlayer(9 + state.wave * 1.4);
        state.projectiles.splice(index, 1);
      }
    }
  }

  function updateEffects(dt) {
    for (let index = state.effects.length - 1; index >= 0; index -= 1) {
      state.effects[index].life -= dt;
      if (state.effects[index].life <= 0) state.effects.splice(index, 1);
    }
  }

  function updateProgression(dt) {
    if (player.dead || player.victorious) return;
    if (state.enemies.length === 0) {
      state.betweenWaveTimer -= dt;
      if (state.betweenWaveTimer <= 0) {
        if (state.wave >= state.maxWave) {
          player.victorious = true;
          showNotice("五波清空，Safari 兼容战场完成", 2600);
          pushFeed("任务完成，Dragon Lore 收工");
          updateBestRecord();
        } else {
          state.wave += 1;
          state.betweenWaveTimer = 1.2;
          spawnWave();
        }
      }
    } else {
      state.betweenWaveTimer = 1.1;
    }
  }

  function drawScene() {
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.5);
    sky.addColorStop(0, "#3a6075");
    sky.addColorStop(1, "#10202e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.5);

    const floor = ctx.createLinearGradient(0, height * 0.5, 0, height);
    floor.addColorStop(0, "#15222d");
    floor.addColorStop(1, "#0c1319");
    ctx.fillStyle = floor;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    const fov = Math.PI / 3;
    const columnWidth = 3;
    const depthBuffer = [];
    for (let screenX = 0; screenX < width; screenX += columnWidth) {
      const ratio = screenX / width;
      const rayAngle = player.angle - fov / 2 + ratio * fov;
      const ray = castRay(rayAngle, 20, 0.025);
      const corrected = ray.distance * Math.cos(rayAngle - player.angle);
      depthBuffer.push(corrected);
      const wallHeight = Math.min(height * 0.88, (height / Math.max(0.0001, corrected)) * 0.92);
      const top = (height - wallHeight) / 2;
      const shade = clamp(1 - corrected / 14, 0.18, 1);
      ctx.fillStyle = `rgba(${Math.floor(86 * shade)}, ${Math.floor(132 * shade)}, ${Math.floor(160 * shade)}, 1)`;
      ctx.fillRect(screenX, top, columnWidth + 1, wallHeight);
      ctx.fillStyle = `rgba(255,255,255,${0.02 + shade * 0.03})`;
      ctx.fillRect(screenX, top, columnWidth + 1, 1);
    }

    const sprites = state.enemies
      .map((enemy) => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.hypot(dx, dy);
        const angleDiff = normAngle(Math.atan2(dy, dx) - player.angle);
        return { enemy, dist, angleDiff };
      })
      .filter((entry) => Math.abs(entry.angleDiff) < fov * 0.7 && entry.dist > 0.2)
      .sort((a, b) => b.dist - a.dist);

    sprites.forEach(({ enemy, dist, angleDiff }) => {
      const projectedX = (angleDiff / (fov / 2)) * (width / 2) + width / 2;
      const size = clamp((height / dist) * 0.52, 24, height * 0.45);
      const screenColumn = Math.floor(projectedX / columnWidth);
      if (depthBuffer[screenColumn] && depthBuffer[screenColumn] < dist - 0.18) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(projectedX, height / 2, size * 0.38, 0, Math.PI * 2);
      ctx.clip();
      if (avatarImage.complete && avatarImage.naturalWidth) {
        ctx.drawImage(avatarImage, projectedX - size * 0.42, height / 2 - size * 0.42, size * 0.84, size * 0.84);
      } else {
        ctx.fillStyle = "#d7c5ba";
        ctx.fillRect(projectedX - size * 0.42, height / 2 - size * 0.42, size * 0.84, size * 0.84);
      }
      ctx.restore();
      ctx.strokeStyle = enemy.hitFlash > 0 ? "#ff8c6b" : "rgba(255,255,255,0.88)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(projectedX, height / 2, size * 0.38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(17, 24, 31, 0.82)";
      ctx.fillRect(projectedX - size * 0.4, height / 2 + size * 0.48, size * 0.8, 8);
      ctx.fillStyle = "#ff6a47";
      ctx.fillRect(projectedX - size * 0.4, height / 2 + size * 0.48, size * 0.8 * clamp(enemy.health / enemy.maxHealth, 0, 1), 8);
    });

    state.projectiles.forEach((shot) => {
      const dx = shot.x - player.x;
      const dy = shot.y - player.y;
      const dist = Math.hypot(dx, dy);
      const angleDiff = normAngle(Math.atan2(dy, dx) - player.angle);
      if (Math.abs(angleDiff) > fov / 2) return;
      const x = (angleDiff / (fov / 2)) * (width / 2) + width / 2;
      const size = clamp((height / dist) * 0.06, 4, 18);
      ctx.fillStyle = "#ff6b4a";
      ctx.beginPath();
      ctx.arc(x, height / 2, size, 0, Math.PI * 2);
      ctx.fill();
    });

    state.effects.forEach((effect) => {
      if (effect.type === "hit") {
        const angleDiff = normAngle(Math.atan2(effect.y - player.y, effect.x - player.x) - player.angle);
        if (Math.abs(angleDiff) > fov / 2) return;
        const x = (angleDiff / (fov / 2)) * (width / 2) + width / 2;
        ctx.strokeStyle = `rgba(255,120,84,${clamp(effect.life / 0.25, 0, 1)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, height / 2, 14 + (1 - effect.life / 0.25) * 18, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    const gunY = height - 140 + player.gunKick * 22;
    ctx.save();
    ctx.translate(width * 0.72, gunY);
    ctx.rotate(-0.16 - player.gunKick * 0.08);
    ctx.fillStyle = weaponPattern || "#d89a39";
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-180, 10);
    ctx.lineTo(60, -30);
    ctx.lineTo(280, -54);
    ctx.lineTo(304, -24);
    ctx.lineTo(96, 6);
    ctx.lineTo(48, 74);
    ctx.lineTo(-10, 108);
    ctx.lineTo(-36, 58);
    ctx.lineTo(-102, 78);
    ctx.lineTo(-122, 30);
    ctx.lineTo(-170, 38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(18, 24, 29, 0.82)";
    ctx.fillRect(94, -58, 128, 16);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "600 18px Avenir Next";
    ctx.fillText("AWP DRAGON LORE", -108, -44);
    ctx.restore();
  }

  function drawMinimap() {
    if (!minimapCtx) return;
    const size = minimapCanvas.width;
    const cell = size / mapSize;
    minimapCtx.clearRect(0, 0, size, size);
    minimapCtx.fillStyle = "#08111c";
    minimapCtx.fillRect(0, 0, size, size);
    for (let y = 0; y < mapSize; y += 1) {
      for (let x = 0; x < mapSize; x += 1) {
        if (mapRows[y][x] === "#") {
          minimapCtx.fillStyle = "rgba(255,255,255,0.16)";
          minimapCtx.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }
    state.enemies.forEach((enemy) => {
      minimapCtx.fillStyle = "#ff6a47";
      minimapCtx.beginPath();
      minimapCtx.arc(enemy.x * cell, enemy.y * cell, 4, 0, Math.PI * 2);
      minimapCtx.fill();
    });
    minimapCtx.fillStyle = "#53f3d4";
    minimapCtx.beginPath();
    minimapCtx.arc(player.x * cell, player.y * cell, 5, 0, Math.PI * 2);
    minimapCtx.fill();
    minimapCtx.strokeStyle = "#53f3d4";
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(player.x * cell, player.y * cell);
    minimapCtx.lineTo((player.x + Math.cos(player.angle) * 0.8) * cell, (player.y + Math.sin(player.angle) * 0.8) * cell);
    minimapCtx.stroke();
  }

  function updateCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(800, Math.floor(rect.width * pixelRatio));
    const nextHeight = Math.max(450, Math.floor(rect.height * pixelRatio));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  }

  const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const requestFullscreen = () => {
    if (playfield.requestFullscreen) return playfield.requestFullscreen();
    if (playfield.webkitRequestFullscreen) return playfield.webkitRequestFullscreen();
    return Promise.resolve();
  };
  const exitFullscreen = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return Promise.resolve();
  };

  const handleAimClick = () => {
    state.hoverActive = true;
    showNotice("Safari 兼容瞄准已激活", 1200);
  };
  const handleFullscreenClick = () => {
    if (getFullscreenElement()) exitFullscreen();
    else requestFullscreen();
  };
  const handleMouseMove = (event) => {
    const point = canvasPoint(canvas, event);
    const normalized = clamp(point.x / canvas.width, 0, 1);
    state.mouseTurn = (normalized - 0.5) * 2;
    state.hoverActive = true;
  };
  const handleMouseLeave = () => {
    state.mouseTurn = 0;
    state.hoverActive = false;
  };
  const handleMouseDown = (event) => {
    if (event.button === 0) {
      state.fireHeld = true;
      fireWeapon();
      if (!state.started) {
        state.started = true;
        pushFeed("Safari 兼容战场已接管");
      }
    }
  };
  const handleMouseUp = () => {
    state.fireHeld = false;
  };
  const handleKeyDown = (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "shift", "r", "f", " "].includes(key) || event.key === "Shift") event.preventDefault();
    if (key === "w") input.forward = true;
    if (key === "s") input.backward = true;
    if (key === "a") input.left = true;
    if (key === "d") input.right = true;
    if (key === "shift") input.sprint = true;
    if (key === "r" && player.reload <= 0 && player.clip < 5 && player.reserve > 0) {
      player.reload = 1.2;
      pushFeed("开始换弹");
    }
    if (key === " ") {
      state.fireHeld = true;
      fireWeapon();
    }
    if (key === "f") handleFullscreenClick();
  };
  const handleKeyUp = (event) => {
    const key = event.key.toLowerCase();
    if (key === "w") input.forward = false;
    if (key === "s") input.backward = false;
    if (key === "a") input.left = false;
    if (key === "d") input.right = false;
    if (key === "shift") input.sprint = false;
    if (key === " ") state.fireHeld = false;
  };

  aimButton.addEventListener("click", handleAimClick);
  fullscreenButton.addEventListener("click", handleFullscreenClick);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseleave", handleMouseLeave);
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("dblclick", handleFullscreenClick);
  window.addEventListener("mouseup", handleMouseUp);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  document.addEventListener("fullscreenchange", updateCanvasSize);
  document.addEventListener("webkitfullscreenchange", updateCanvasSize);

  disposer.add(() => {
    aimButton.removeEventListener("click", handleAimClick);
    fullscreenButton.removeEventListener("click", handleFullscreenClick);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("mouseleave", handleMouseLeave);
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("dblclick", handleFullscreenClick);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    document.removeEventListener("fullscreenchange", updateCanvasSize);
    document.removeEventListener("webkitfullscreenchange", updateCanvasSize);
    clearTimeout(noticeTimer);
  });

  loadDragonLoreModelData()
    .then((model) => {
      weaponBitmap = model.weaponPrimitives[0]?.material?.textureBitmap || null;
      if (weaponBitmap) {
        weaponPattern = ctx.createPattern(weaponBitmap, "repeat");
        pushFeed("Dragon Lore 模型贴图已接入 Safari 兼容版");
      }
    })
    .catch((error) => {
      pushFeed(`模型贴图读取失败：${error.message}`);
    });

  updateCanvasSize();
  updateHud();
  pushFeed(options.reason ? `已切到 Safari 兼容版：${options.reason}` : "Safari 兼容版待命");
  spawnWave();

  disposer.raf((dt) => {
    updateCanvasSize();
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateProgression(dt);
    updateHud();
    drawMinimap();
    drawScene();
  });

  return () => disposer.destroy();
}

function mountDragonLoreFPS(host) {
  const ua = navigator.userAgent || "";
  const isSafariBrowser = /safari/i.test(ua) && !/chrome|chromium|android/i.test(ua);
  if (isSafariBrowser) {
    return mountDragonLoreFPSCanvas(host, { reason: "Safari 强制走 Canvas FPS 兼容路径" });
  }

  const disposer = createDisposer();
  const { shell, playfield, panel, canvas, notice } = createGameLayout(host, {
    canvas: true,
    width: 1600,
    height: 900,
    context: null,
  });
  const renderer = fpsCreateRendererContext(canvas);
  const { gl } = renderer;

  shell.classList.add("fps-shell");
  playfield.classList.add("fps-playfield");
  panel.classList.add("fps-panel");
  canvas.classList.add("fps-canvas");

  if (!gl || typeof gl.getContextAttributes !== "function") {
    panel.append(el("p", "inline-help", "当前浏览器不支持 WebGL，这个 3D 关卡跑不起来。"));
    notice.textContent = "WebGL 不可用";
    notice.classList.add("visible");
    return () => disposer.destroy();
  }

  const scoreRefs = createScoreStrip(panel, [
    { key: "health", label: "血量", value: "100" },
    { key: "ammo", label: "子弹", value: "5 / 25" },
    { key: "wave", label: "波次", value: "1 / 5" },
    { key: "kills", label: "击杀", value: "0" },
  ]);

  const actionRow = el("div", "tool-row fps-tools");
  const lockButton = el("button", "small-button", "锁定鼠标");
  const fullscreenButton = el("button", "small-button", "全屏作战");
  actionRow.append(lockButton, fullscreenButton);
  panel.append(actionRow);

  const minimapSection = el("section", "");
  const minimapTitle = el("h4", "", "战术雷达");
  const minimapCanvas = document.createElement("canvas");
  minimapCanvas.width = 220;
  minimapCanvas.height = 220;
  minimapCanvas.className = "fps-minimap";
  minimapSection.append(minimapTitle, minimapCanvas);
  panel.append(minimapSection);
  const minimapCtx = minimapCanvas.getContext("2d");

  const feedSection = el("section", "");
  feedSection.append(el("h4", "", "战况播报"));
  const feedList = el("div", "fps-feed");
  feedSection.append(feedList);
  panel.append(feedSection);

  addPanelText(panel, "任务", "用 <strong>AWP Dragon Lore</strong> 顶住五波突围。敌人会追击、绕点、发射能量弹。清空当前波次后自动进入下一波。",);
  addPanelList(panel, "操作", [
    "点击画面或按钮锁定鼠标，进入第一人称视角。",
    "WASD 移动，Shift 冲刺，左键开火，R 换弹。",
    "F 或双击画面进入全屏，Esc 解除锁定。",
  ]);

  const hud = el("div", "fps-hud");
  hud.innerHTML = `
    <div class="fps-banner">
      <span class="mini-label">DRAGON LORE OPS</span>
      <strong>点击进入第一人称战斗</strong>
      <span class="fps-subtitle">本地离线 ${renderer.isWebGL2 ? "WebGL2" : "WebGL1"} + GLB 枪模</span>
    </div>
    <div class="fps-crosshair" aria-hidden="true"></div>
    <div class="fps-bottom-bar">
      <div>
        <span>目标</span>
        <strong id="fpsObjective">清空第 1 波敌人</strong>
      </div>
      <div>
        <span>最佳记录</span>
        <strong id="fpsBest">0 击杀 / W1</strong>
      </div>
    </div>
    <div class="fps-hit-overlay"></div>
  `;
  playfield.append(hud);

  const objectiveEl = hud.querySelector("#fpsObjective");
  const bestEl = hud.querySelector("#fpsBest");
  const hitOverlay = hud.querySelector(".fps-hit-overlay");

  const storageKey = "dragon-lore-fps-best";
  const bestRecord = safeGet(storageKey, { kills: 0, wave: 1 });
  bestEl.textContent = `${bestRecord.kills} 击杀 / W${bestRecord.wave}`;

  let noticeTimer = 0;
  let disposed = false;

  function showNotice(message, duration = 1800) {
    notice.textContent = message;
    notice.classList.add("visible");
    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => notice.classList.remove("visible"), duration);
  }

  const feeds = [];
  function pushFeed(message) {
    feeds.unshift(message);
    if (feeds.length > 6) {
      feeds.length = 6;
    }
    feedList.innerHTML = feeds.map((line) => `<div class="fps-feed-line">${line}</div>`).join("");
  }

  const getFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const requestFullscreen = () => {
    if (playfield.requestFullscreen) {
      return playfield.requestFullscreen();
    }
    if (playfield.webkitRequestFullscreen) {
      return playfield.webkitRequestFullscreen();
    }
    return Promise.resolve();
  };
  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      return document.exitFullscreen();
    }
    if (document.webkitExitFullscreen) {
      return document.webkitExitFullscreen();
    }
    return Promise.resolve();
  };

  const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    fireHeld: false,
  };

  const worldSize = 48;
  const halfWorld = worldSize / 2;
  const eyeHeight = 1.52;
  const spawnPoints = [
    fpsVec3(-17, 0.9, -17),
    fpsVec3(17, 0.9, -17),
    fpsVec3(-17, 0.9, 17),
    fpsVec3(17, 0.9, 17),
    fpsVec3(0, 0.9, -20),
    fpsVec3(-20, 0.9, 0),
    fpsVec3(20, 0.9, 0),
  ];

  const obstacles = [
    { x: 0, y: 1.8, z: -9, sx: 8, sy: 3.6, sz: 2.2, color: [0.13, 0.2, 0.25, 1] },
    { x: 0, y: 1.8, z: 9, sx: 8, sy: 3.6, sz: 2.2, color: [0.13, 0.2, 0.25, 1] },
    { x: -9, y: 1.6, z: 0, sx: 2.4, sy: 3.2, sz: 8, color: [0.17, 0.24, 0.3, 1] },
    { x: 9, y: 1.6, z: 0, sx: 2.4, sy: 3.2, sz: 8, color: [0.17, 0.24, 0.3, 1] },
    { x: -14, y: 1, z: -6, sx: 3.6, sy: 2, sz: 3.6, color: [0.33, 0.25, 0.16, 1] },
    { x: 14, y: 1, z: 6, sx: 3.6, sy: 2, sz: 3.6, color: [0.33, 0.25, 0.16, 1] },
    { x: -3.5, y: 0.9, z: 0, sx: 3, sy: 1.8, sz: 3, color: [0.22, 0.15, 0.13, 1] },
    { x: 3.5, y: 0.9, z: 0, sx: 3, sy: 1.8, sz: 3, color: [0.22, 0.15, 0.13, 1] },
  ];

  const perimeterWalls = [
    { x: 0, y: 1.5, z: -halfWorld - 0.5, sx: worldSize + 2, sy: 3, sz: 1, color: [0.1, 0.13, 0.17, 1] },
    { x: 0, y: 1.5, z: halfWorld + 0.5, sx: worldSize + 2, sy: 3, sz: 1, color: [0.1, 0.13, 0.17, 1] },
    { x: -halfWorld - 0.5, y: 1.5, z: 0, sx: 1, sy: 3, sz: worldSize, color: [0.1, 0.13, 0.17, 1] },
    { x: halfWorld + 0.5, y: 1.5, z: 0, sx: 1, sy: 3, sz: worldSize, color: [0.1, 0.13, 0.17, 1] },
  ];

  const player = {
    position: fpsVec3(0, eyeHeight, 17),
    yaw: Math.PI,
    pitch: -0.05,
    radius: 0.48,
    health: 100,
    clip: 5,
    reserve: 25,
    reload: 0,
    fireCooldown: 0,
    recoil: 0,
    sway: 0,
    sprintEnergy: 1,
    kills: 0,
    wave: 1,
    victorious: false,
    dead: false,
    hitFlash: 0,
  };

  const state = {
    started: false,
    wave: 1,
    maxWave: 5,
    enemies: [],
    enemyProjectiles: [],
    effects: [],
    betweenWaveTimer: 0.8,
    pointerLocked: false,
    canvasHover: false,
    lastShotWasHit: false,
  };

  function getForwardVector() {
    return fpsVec3Normalize({
      x: Math.sin(player.yaw) * Math.cos(player.pitch),
      y: Math.sin(player.pitch),
      z: Math.cos(player.yaw) * Math.cos(player.pitch),
    });
  }

  function getRightVector() {
    const forward = getForwardVector();
    return fpsVec3Normalize({ x: forward.z, y: 0, z: -forward.x });
  }

  function getGroundPosition() {
    return fpsVec3(player.position.x, 0.9, player.position.z);
  }

  function updateHud() {
    scoreRefs.health.textContent = String(Math.max(0, Math.ceil(player.health)));
    scoreRefs.ammo.textContent = `${player.clip} / ${player.reserve}`;
    scoreRefs.wave.textContent = `${Math.min(state.wave, state.maxWave)} / ${state.maxWave}`;
    scoreRefs.kills.textContent = String(player.kills);
    objectiveEl.textContent = player.victorious
      ? "清场完成，Dragon Lore 收工"
      : player.dead
        ? "已倒下，点重新开始再打一次"
        : `清空第 ${Math.min(state.wave, state.maxWave)} 波敌人`;
    hitOverlay.style.opacity = String(clamp(player.hitFlash, 0, 1));
  }

  function updateBestRecord() {
    if (player.kills > bestRecord.kills || (player.kills === bestRecord.kills && state.wave > bestRecord.wave)) {
      bestRecord.kills = player.kills;
      bestRecord.wave = state.wave;
      safeSet(storageKey, bestRecord);
      bestEl.textContent = `${bestRecord.kills} 击杀 / W${bestRecord.wave}`;
    }
  }

  function spawnEffect(type, position, extra = {}) {
    state.effects.push({ type, position: { ...position }, life: extra.life || 0.35, size: extra.size || 0.18, color: extra.color || [1, 0.6, 0.2, 1] });
  }

  function createEnemy(index) {
    const spawn = choice(spawnPoints);
    const radius = rand(0.72, 1.05);
    const health = 70 + state.wave * 18;
    return {
      id: `${state.wave}-${index}-${Math.random().toString(16).slice(2, 8)}`,
      position: fpsVec3(spawn.x + rand(-1.8, 1.8), 0.95, spawn.z + rand(-1.8, 1.8)),
      radius,
      health,
      maxHealth: health,
      speed: 2.3 + state.wave * 0.22 + rand(-0.18, 0.22),
      fireCooldown: rand(0.7, 1.6),
      strafePhase: rand(0, Math.PI * 2),
      flash: 0,
      bob: rand(0, Math.PI * 2),
    };
  }

  function spawnWave() {
    const enemyCount = 3 + state.wave * 2;
    state.enemies = Array.from({ length: enemyCount }, (_, index) => createEnemy(index));
    state.enemyProjectiles.length = 0;
    pushFeed(`第 ${state.wave} 波入场：${enemyCount} 个目标上线`);
    showNotice(`第 ${state.wave} 波开始`, 1600);
    updateHud();
  }

  function resolveCapsuleCollision(entity) {
    entity.position.x = clamp(entity.position.x, -halfWorld + 1.2, halfWorld - 1.2);
    entity.position.z = clamp(entity.position.z, -halfWorld + 1.2, halfWorld - 1.2);

    const blockers = obstacles.concat(perimeterWalls);
    blockers.forEach((box) => {
      const nearestX = clamp(entity.position.x, box.x - box.sx / 2, box.x + box.sx / 2);
      const nearestZ = clamp(entity.position.z, box.z - box.sz / 2, box.z + box.sz / 2);
      const dx = entity.position.x - nearestX;
      const dz = entity.position.z - nearestZ;
      const distSq = dx * dx + dz * dz;
      const minDist = entity.radius + 0.08;
      if (distSq > 0 && distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const push = (minDist - dist) / dist;
        entity.position.x += dx * push;
        entity.position.z += dz * push;
      }
    });
  }

  function projectileHitsWall(projectile) {
    return obstacles.concat(perimeterWalls).some((box) => (
      projectile.position.x > box.x - box.sx / 2 &&
      projectile.position.x < box.x + box.sx / 2 &&
      projectile.position.y > box.y - box.sy / 2 &&
      projectile.position.y < box.y + box.sy / 2 &&
      projectile.position.z > box.z - box.sz / 2 &&
      projectile.position.z < box.z + box.sz / 2
    ));
  }

  function enemyColor(enemy) {
    const ratio = clamp(enemy.health / enemy.maxHealth, 0, 1);
    return [0.9, 0.18 + ratio * 0.45, 0.18 + ratio * 0.16, 1];
  }

  function fireWeapon() {
    if (player.dead || player.victorious || player.reload > 0 || player.fireCooldown > 0) {
      return;
    }
    if (player.clip <= 0) {
      if (player.reserve > 0) {
        startReload();
      } else {
        showNotice("子弹打空了", 1200);
      }
      return;
    }

    player.clip -= 1;
    player.fireCooldown = 0.62;
    player.recoil = 1;
    spawnEffect("muzzle", fpsVec3(player.position.x, eyeHeight - 0.12, player.position.z), { life: 0.08, size: 0.46, color: [1, 0.88, 0.42, 1] });

    const origin = fpsVec3(player.position.x, eyeHeight, player.position.z);
    const direction = getForwardVector();
    let closestHit = null;

    state.enemies.forEach((enemy) => {
      const target = fpsVec3(enemy.position.x, enemy.position.y, enemy.position.z);
      const hitDistance = fpsRaySphere(origin, direction, target, enemy.radius * 0.92);
      if (hitDistance !== null && (!closestHit || hitDistance < closestHit.distance)) {
        closestHit = { enemy, distance: hitDistance };
      }
    });

    if (closestHit) {
      const hitPoint = fpsVec3Add(origin, fpsVec3Scale(direction, closestHit.distance));
      const damage = 110 + state.wave * 8;
      closestHit.enemy.health -= damage;
      closestHit.enemy.flash = 1;
      spawnEffect("hit", hitPoint, { life: 0.24, size: 0.34, color: [1, 0.36, 0.26, 1] });
      pushFeed(`龙狙命中 ${Math.ceil(damage)} 伤害`);

      if (closestHit.enemy.health <= 0) {
        state.enemies = state.enemies.filter((enemy) => enemy !== closestHit.enemy);
        player.kills += 1;
        player.reserve = clamp(player.reserve + 1, 0, 40);
        pushFeed(`一枪带走，当前 ${player.kills} 击杀`);
        showNotice("命中清除", 900);
        updateBestRecord();
      }
    } else {
      const missPoint = fpsVec3Add(origin, fpsVec3Scale(direction, 28));
      spawnEffect("miss", missPoint, { life: 0.14, size: 0.16, color: [0.75, 0.82, 1, 1] });
    }

    updateHud();
  }

  function startReload() {
    if (player.dead || player.victorious || player.reload > 0 || player.clip >= 5 || player.reserve <= 0) {
      return;
    }
    player.reload = 1.42;
    pushFeed("开始换弹");
    showNotice("换弹中", 900);
  }

  function damagePlayer(amount) {
    if (player.dead || player.victorious) {
      return;
    }
    player.health = clamp(player.health - amount, 0, 100);
    player.hitFlash = 0.78;
    pushFeed(`你受到 ${Math.ceil(amount)} 伤害`);
    updateHud();
    if (player.health <= 0) {
      player.dead = true;
      showNotice("你被击倒了", 2200);
      pushFeed("本局失败，等待重开");
      updateBestRecord();
    }
  }

  function updatePlayer(dt) {
    if (player.dead || player.victorious) {
      player.recoil = Math.max(0, player.recoil - dt * 4.4);
      player.hitFlash = Math.max(0, player.hitFlash - dt * 1.5);
      return;
    }

    const forward = getForwardVector();
    const flatForward = fpsVec3Normalize({ x: forward.x, y: 0, z: forward.z });
    const right = getRightVector();
    let move = fpsVec3();

    if (input.forward) move = fpsVec3Add(move, flatForward);
    if (input.backward) move = fpsVec3Sub(move, flatForward);
    if (input.left) move = fpsVec3Sub(move, right);
    if (input.right) move = fpsVec3Add(move, right);

    const moveLength = fpsVec3Length(move);
    if (moveLength > 0) {
      move = fpsVec3Scale(move, 1 / moveLength);
      const sprinting = input.sprint && player.sprintEnergy > 0.15;
      const speed = sprinting ? 8.6 : 5.2;
      if (sprinting) {
        player.sprintEnergy = Math.max(0, player.sprintEnergy - dt * 0.32);
      } else {
        player.sprintEnergy = Math.min(1, player.sprintEnergy + dt * 0.22);
      }
      player.position.x += move.x * speed * dt;
      player.position.z += move.z * speed * dt;
      player.sway += dt * speed * 1.8;
    } else {
      player.sprintEnergy = Math.min(1, player.sprintEnergy + dt * 0.28);
      player.sway += dt * 1.8;
    }

    resolveCapsuleCollision(player);

    if (player.reload > 0) {
      player.reload = Math.max(0, player.reload - dt);
      if (player.reload === 0) {
        const missing = 5 - player.clip;
        const refill = Math.min(missing, player.reserve);
        player.clip += refill;
        player.reserve -= refill;
        pushFeed(`换弹完成，装入 ${refill} 发`);
      }
    }

    if (input.fireHeld && (state.pointerLocked || state.canvasHover)) {
      fireWeapon();
    }

    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.recoil = Math.max(0, player.recoil - dt * 5.5);
    player.hitFlash = Math.max(0, player.hitFlash - dt * 1.85);
  }

  function updateEnemies(dt) {
    if (player.dead || player.victorious) {
      return;
    }

    state.enemies.forEach((enemy) => {
      const toPlayer = fpsVec3Sub(getGroundPosition(), enemy.position);
      const distanceToPlayer = Math.hypot(toPlayer.x, toPlayer.z);
      const direction = fpsVec3Normalize({ x: toPlayer.x, y: 0, z: toPlayer.z });
      const strafe = fpsVec3Normalize({ x: direction.z, y: 0, z: -direction.x });
      const chaseBias = distanceToPlayer > 11 ? 1 : distanceToPlayer < 6 ? -0.65 : 0.2;
      const offset = Math.sin(performance.now() * 0.0016 + enemy.strafePhase) * 0.95;
      enemy.position.x += (direction.x * chaseBias + strafe.x * offset * 0.42) * enemy.speed * dt;
      enemy.position.z += (direction.z * chaseBias + strafe.z * offset * 0.42) * enemy.speed * dt;
      enemy.bob += dt * 3.5;
      enemy.position.y = 0.95 + Math.sin(enemy.bob) * 0.08;
      enemy.flash = Math.max(0, enemy.flash - dt * 4.4);
      resolveCapsuleCollision(enemy);

      enemy.fireCooldown -= dt;
      if (enemy.fireCooldown <= 0 && distanceToPlayer < 28) {
        const origin = fpsVec3(enemy.position.x, enemy.position.y + 0.12, enemy.position.z);
        const target = fpsVec3(player.position.x, eyeHeight - 0.16, player.position.z);
        const velocity = fpsVec3Scale(fpsVec3Normalize(fpsVec3Sub(target, origin)), 13 + state.wave * 0.8);
        state.enemyProjectiles.push({
          position: origin,
          velocity,
          life: 3.1,
          radius: 0.18,
        });
        enemy.fireCooldown = rand(0.9, 1.65) - state.wave * 0.05;
      }

      if (distanceToPlayer < enemy.radius + 0.75) {
        damagePlayer(18 * dt);
      }
    });
  }

  function updateProjectiles(dt) {
    for (let index = state.enemyProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = state.enemyProjectiles[index];
      projectile.position.x += projectile.velocity.x * dt;
      projectile.position.y += projectile.velocity.y * dt;
      projectile.position.z += projectile.velocity.z * dt;
      projectile.life -= dt;

      const dx = projectile.position.x - player.position.x;
      const dy = projectile.position.y - eyeHeight;
      const dz = projectile.position.z - player.position.z;
      const hitPlayer = dx * dx + dy * dy + dz * dz < 0.56 * 0.56;

      if (hitPlayer) {
        spawnEffect("hit", projectile.position, { life: 0.2, size: 0.22, color: [1, 0.24, 0.16, 1] });
        damagePlayer(8 + state.wave * 1.5);
        state.enemyProjectiles.splice(index, 1);
        continue;
      }

      if (projectile.life <= 0 || projectileHitsWall(projectile)) {
        state.enemyProjectiles.splice(index, 1);
      }
    }
  }

  function updateEffects(dt) {
    for (let index = state.effects.length - 1; index >= 0; index -= 1) {
      state.effects[index].life -= dt;
      state.effects[index].size += dt * 0.9;
      if (state.effects[index].life <= 0) {
        state.effects.splice(index, 1);
      }
    }
  }

  function updateProgression(dt) {
    if (player.dead || player.victorious) {
      return;
    }

    if (state.enemies.length === 0) {
      state.betweenWaveTimer -= dt;
      if (state.betweenWaveTimer <= 0) {
        if (state.wave >= state.maxWave) {
          player.victorious = true;
          showNotice("五波清空，龙狙突围完成", 2600);
          pushFeed("任务完成，Dragon Lore 收工");
          updateBestRecord();
        } else {
          state.wave += 1;
          player.wave = state.wave;
          state.betweenWaveTimer = 1.35;
          spawnWave();
        }
      }
    } else {
      state.betweenWaveTimer = 1.25;
    }
  }

  function drawMinimap() {
    if (!minimapCtx) {
      return;
    }

    const size = minimapCanvas.width;
    minimapCtx.clearRect(0, 0, size, size);
    minimapCtx.fillStyle = "#08111c";
    minimapCtx.fillRect(0, 0, size, size);
    minimapCtx.strokeStyle = "rgba(255,255,255,0.1)";
    minimapCtx.lineWidth = 1;
    for (let step = 0; step <= 4; step += 1) {
      const line = (size / 4) * step;
      minimapCtx.beginPath();
      minimapCtx.moveTo(line, 0);
      minimapCtx.lineTo(line, size);
      minimapCtx.stroke();
      minimapCtx.beginPath();
      minimapCtx.moveTo(0, line);
      minimapCtx.lineTo(size, line);
      minimapCtx.stroke();
    }

    const scale = size / worldSize;
    function mapPoint(x, z) {
      return {
        x: size / 2 + x * scale,
        y: size / 2 + z * scale,
      };
    }

    obstacles.forEach((box) => {
      const point = mapPoint(box.x, box.z);
      minimapCtx.fillStyle = "rgba(255,255,255,0.14)";
      minimapCtx.fillRect(point.x - box.sx * scale / 2, point.y - box.sz * scale / 2, box.sx * scale, box.sz * scale);
    });

    state.enemies.forEach((enemy) => {
      const point = mapPoint(enemy.position.x, enemy.position.z);
      minimapCtx.beginPath();
      minimapCtx.fillStyle = "#ff6a47";
      minimapCtx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      minimapCtx.fill();
    });

    const playerPoint = mapPoint(player.position.x, player.position.z);
    minimapCtx.beginPath();
    minimapCtx.fillStyle = "#53f3d4";
    minimapCtx.arc(playerPoint.x, playerPoint.y, 5, 0, Math.PI * 2);
    minimapCtx.fill();

    const dir = getForwardVector();
    minimapCtx.strokeStyle = "#53f3d4";
    minimapCtx.lineWidth = 2;
    minimapCtx.beginPath();
    minimapCtx.moveTo(playerPoint.x, playerPoint.y);
    minimapCtx.lineTo(playerPoint.x + dir.x * 14, playerPoint.y + dir.z * 14);
    minimapCtx.stroke();
  }

  const derivativeHeader = renderer.isWebGL2 || renderer.hasDerivatives ? "#extension GL_OES_standard_derivatives : enable\n" : "";
  const webgl2VertexSource = `#version 300 es
    precision highp float;
    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in vec3 aNormal;
    layout(location = 2) in vec2 aUv;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform mat3 uNormalMatrix;

    out vec3 vNormal;
    out vec3 vWorldPos;
    out vec2 vUv;

    void main() {
      vec4 worldPos = uModel * vec4(aPosition, 1.0);
      vWorldPos = worldPos.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vUv = aUv;
      gl_Position = uProjection * uView * worldPos;
    }
  `;

  const webgl1VertexSource = `
    precision highp float;
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;

    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform mat3 uNormalMatrix;

    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    void main() {
      vec4 worldPos = uModel * vec4(aPosition, 1.0);
      vWorldPos = worldPos.xyz;
      vNormal = normalize(uNormalMatrix * aNormal);
      vUv = aUv;
      gl_Position = uProjection * uView * worldPos;
    }
  `;

  const gridSnippet = renderer.isWebGL2 || renderer.hasDerivatives
    ? `
      if (!uUseTexture && uGridMix > 0.0) {
        vec2 gridUv = vWorldPos.xz * 0.22;
        vec2 grid = abs(fract(gridUv - 0.5) - 0.5) / fwidth(gridUv);
        float line = 1.0 - min(min(grid.x, grid.y), 1.0);
        color += vec3(0.14, 0.19, 0.22) * line * uGridMix;
      }
    `
    : `
      if (!uUseTexture && uGridMix > 0.0) {
        vec2 cell = abs(fract(vWorldPos.xz * 0.22 - 0.5) - 0.5);
        float line = 1.0 - step(0.045, min(cell.x, cell.y));
        color += vec3(0.12, 0.16, 0.18) * line * uGridMix;
      }
    `;

  const webgl2FragmentSource = `#version 300 es
    precision highp float;
    in vec3 vNormal;
    in vec3 vWorldPos;
    in vec2 vUv;

    uniform sampler2D uTexture;
    uniform vec4 uBaseColor;
    uniform bool uUseTexture;
    uniform vec3 uLightDir;
    uniform vec3 uViewPos;
    uniform float uFogDensity;
    uniform float uGridMix;

    out vec4 outColor;

    void main() {
      vec4 texel = uUseTexture ? texture(uTexture, vUv) : vec4(1.0);
      vec3 normal = normalize(vNormal);
      float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
      float hemi = normal.y * 0.5 + 0.5;
      float fresnel = pow(1.0 - max(dot(normal, normalize(uViewPos - vWorldPos)), 0.0), 2.0);
      vec3 color = texel.rgb * uBaseColor.rgb;
      color *= 0.42 + hemi * 0.26 + diffuse * 0.72;
      color += fresnel * 0.12;
      ${gridSnippet}
      float dist = length(vWorldPos - uViewPos);
      float fog = clamp(exp(-dist * uFogDensity), 0.0, 1.0);
      vec3 fogColor = vec3(0.09, 0.12, 0.16);
      outColor = vec4(mix(fogColor, color, fog), texel.a * uBaseColor.a);
    }
  `;

  const webgl1FragmentSource = `
    ${derivativeHeader}
    precision highp float;
    varying vec3 vNormal;
    varying vec3 vWorldPos;
    varying vec2 vUv;

    uniform sampler2D uTexture;
    uniform vec4 uBaseColor;
    uniform bool uUseTexture;
    uniform vec3 uLightDir;
    uniform vec3 uViewPos;
    uniform float uFogDensity;
    uniform float uGridMix;

    void main() {
      vec4 texel = uUseTexture ? texture2D(uTexture, vUv) : vec4(1.0);
      vec3 normal = normalize(vNormal);
      float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);
      float hemi = normal.y * 0.5 + 0.5;
      float fresnel = pow(1.0 - max(dot(normal, normalize(uViewPos - vWorldPos)), 0.0), 2.0);
      vec3 color = texel.rgb * uBaseColor.rgb;
      color *= 0.42 + hemi * 0.26 + diffuse * 0.72;
      color += fresnel * 0.12;
      ${gridSnippet}
      float dist = length(vWorldPos - uViewPos);
      float fog = clamp(exp(-dist * uFogDensity), 0.0, 1.0);
      vec3 fogColor = vec3(0.09, 0.12, 0.16);
      gl_FragColor = vec4(mix(fogColor, color, fog), texel.a * uBaseColor.a);
    }
  `;

  let program;
  try {
    program = fpsCreateProgram(
      gl,
      renderer.isWebGL2 ? webgl2VertexSource : webgl1VertexSource,
      renderer.isWebGL2 ? webgl2FragmentSource : webgl1FragmentSource,
      { aPosition: 0, aNormal: 1, aUv: 2 },
    );
  } catch (error) {
    disposer.destroy();
    return mountDragonLoreFPSCanvas(host, { reason: `WebGL 初始化失败，已回退 Canvas：${error.message}` });
  }
  const programInfo = {
    program,
    attributes: {
      position: 0,
      normal: 1,
      uv: 2,
    },
    uniforms: {
      projection: gl.getUniformLocation(program, "uProjection"),
      view: gl.getUniformLocation(program, "uView"),
      model: gl.getUniformLocation(program, "uModel"),
      normalMatrix: gl.getUniformLocation(program, "uNormalMatrix"),
      texture: gl.getUniformLocation(program, "uTexture"),
      baseColor: gl.getUniformLocation(program, "uBaseColor"),
      useTexture: gl.getUniformLocation(program, "uUseTexture"),
      lightDir: gl.getUniformLocation(program, "uLightDir"),
      viewPos: gl.getUniformLocation(program, "uViewPos"),
      fogDensity: gl.getUniformLocation(program, "uFogDensity"),
      gridMix: gl.getUniformLocation(program, "uGridMix"),
    },
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.08, 0.11, 0.15, 1);

  const whiteTexture = fpsCreateSolidTexture(gl, [255, 255, 255, 255]);
  const avatarTexture = avatarImage.complete && avatarImage.naturalWidth ? fpsCreateBitmapTexture(gl, avatarImage, renderer) : whiteTexture;

  const resources = [];
  const worldResources = {
    floor: fpsCreateMeshResource(gl, programInfo, fpsCreatePlanePrimitive(), renderer),
    cube: fpsCreateMeshResource(gl, programInfo, fpsCreateCubePrimitive(), renderer),
    sphere: fpsCreateMeshResource(gl, programInfo, fpsCreateSpherePrimitive(10, 14), renderer),
  };
  resources.push(worldResources.floor, worldResources.cube, worldResources.sphere);

  let weaponResources = [];
  let weaponReady = false;

  function renderMesh(resource, projection, view, model, options = {}) {
    if (resource.vao && gl.bindVertexArray) {
      gl.bindVertexArray(resource.vao);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, resource.positionBuffer);
      gl.enableVertexAttribArray(programInfo.attributes.position);
      gl.vertexAttribPointer(programInfo.attributes.position, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, resource.normalBuffer);
      gl.enableVertexAttribArray(programInfo.attributes.normal);
      gl.vertexAttribPointer(programInfo.attributes.normal, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, resource.uvBuffer);
      gl.enableVertexAttribArray(programInfo.attributes.uv);
      gl.vertexAttribPointer(programInfo.attributes.uv, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, resource.indexBuffer);
    }
    gl.uniformMatrix4fv(programInfo.uniforms.projection, false, projection);
    gl.uniformMatrix4fv(programInfo.uniforms.view, false, view);
    gl.uniformMatrix4fv(programInfo.uniforms.model, false, model);
    gl.uniformMatrix3fv(programInfo.uniforms.normalMatrix, false, fpsMat3FromMat4(model));
    gl.uniform4fv(programInfo.uniforms.baseColor, options.baseColor || [1, 1, 1, 1]);
    gl.uniform1i(programInfo.uniforms.useTexture, options.useTexture ? 1 : 0);
    gl.uniform1f(programInfo.uniforms.gridMix, options.gridMix || 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, options.texture || whiteTexture);
    gl.uniform1i(programInfo.uniforms.texture, 0);
    gl.drawElements(gl.TRIANGLES, resource.count, resource.indexType, 0);
  }

  function drawWorld() {
    const aspect = canvas.width / canvas.height;
    const projection = fpsMat4Perspective(Math.PI / 3.15, aspect, 0.1, 120);
    const eye = fpsVec3(player.position.x, eyeHeight, player.position.z);
    const forward = getForwardVector();
    const target = fpsVec3Add(eye, forward);
    const view = fpsMat4LookAt(eye, target, fpsVec3(0, 1, 0));

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform3fv(programInfo.uniforms.lightDir, new Float32Array([0.42, 1, 0.25]));
    gl.uniform3fv(programInfo.uniforms.viewPos, new Float32Array([eye.x, eye.y, eye.z]));
    gl.uniform1f(programInfo.uniforms.fogDensity, 0.018);

    const floorMatrix = fpsMat4Multiply(fpsMat4Translation(0, 0, 0), fpsMat4Scale(worldSize, 1, worldSize));
    renderMesh(worldResources.floor, projection, view, floorMatrix, {
      texture: whiteTexture,
      baseColor: [0.18, 0.25, 0.31, 1],
      useTexture: false,
      gridMix: 1,
    });

    obstacles.concat(perimeterWalls).forEach((box) => {
      const matrix = fpsMat4Multiply(
        fpsMat4Translation(box.x, box.y, box.z),
        fpsMat4Scale(box.sx, box.sy, box.sz),
      );
      renderMesh(worldResources.cube, projection, view, matrix, {
        texture: whiteTexture,
        baseColor: box.color,
        useTexture: false,
      });
    });

    state.enemies.forEach((enemy) => {
      const scale = enemy.radius;
      const matrix = fpsMat4Multiply(
        fpsMat4Translation(enemy.position.x, enemy.position.y, enemy.position.z),
        fpsMat4Scale(scale, scale, scale),
      );
      const tint = enemyColor(enemy);
      const flash = enemy.flash;
      renderMesh(worldResources.sphere, projection, view, matrix, {
        texture: avatarTexture,
        baseColor: [Math.min(1, tint[0] + flash * 0.45), tint[1], tint[2], 1],
        useTexture: avatarTexture !== whiteTexture,
      });
    });

    state.enemyProjectiles.forEach((projectile) => {
      const matrix = fpsMat4Multiply(
        fpsMat4Translation(projectile.position.x, projectile.position.y, projectile.position.z),
        fpsMat4Scale(projectile.radius, projectile.radius, projectile.radius),
      );
      renderMesh(worldResources.sphere, projection, view, matrix, {
        texture: whiteTexture,
        baseColor: [1, 0.3, 0.18, 1],
        useTexture: false,
      });
    });

    state.effects.forEach((effect) => {
      const alpha = clamp(effect.life / 0.35, 0, 1);
      const matrix = fpsMat4Multiply(
        fpsMat4Translation(effect.position.x, effect.position.y, effect.position.z),
        fpsMat4Scale(effect.size, effect.size, effect.size),
      );
      renderMesh(worldResources.sphere, projection, view, matrix, {
        texture: whiteTexture,
        baseColor: [effect.color[0], effect.color[1], effect.color[2], alpha],
        useTexture: false,
      });
    });
  }

  function drawWeapon() {
    if (!weaponReady) {
      return;
    }

    gl.useProgram(program);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const aspect = canvas.width / canvas.height;
    const projection = fpsMat4Perspective(Math.PI / 2.85, aspect, 0.01, 20);
    const view = fpsMat4Identity();
    const swayOffset = Math.sin(player.sway * 0.75) * 0.018;
    const swayLift = Math.cos(player.sway * 1.5) * 0.012;
    gl.uniform3fv(programInfo.uniforms.lightDir, new Float32Array([0.35, 1, 0.2]));

    weaponResources.forEach((weapon) => {
      gl.uniform3fv(programInfo.uniforms.viewPos, new Float32Array([0, 0, 0]));
      gl.uniform1f(programInfo.uniforms.fogDensity, 0.01);
      let model = fpsMat4Translation(0.58 + swayOffset, -0.62 + swayLift, -1.46);
      model = fpsMat4Multiply(model, fpsMat4RotateY(Math.PI - 0.08));
      model = fpsMat4Multiply(model, fpsMat4RotateX(-0.2 - player.recoil * 0.18));
      model = fpsMat4Multiply(model, fpsMat4RotateZ(-0.04 - player.recoil * 0.06));
      model = fpsMat4Multiply(model, fpsMat4Scale(0.0315, 0.0315, 0.0315));
      model = fpsMat4Multiply(model, weapon.baseMatrix);
      renderMesh(weapon.resource, projection, view, model, {
        texture: weapon.texture,
        baseColor: weapon.baseColor,
        useTexture: true,
      });
    });
  }

  function updateCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(800, Math.floor(rect.width * pixelRatio));
    const nextHeight = Math.max(450, Math.floor(rect.height * pixelRatio));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }
  }

  function handlePointerLock() {
    const lockedElement = document.pointerLockElement || document.webkitPointerLockElement;
    state.pointerLocked = lockedElement === canvas;
    hud.classList.toggle("locked", state.pointerLocked);
    lockButton.textContent = state.pointerLocked ? "已锁定" : "锁定鼠标";
  }

  function requestPointerLock() {
    if (canvas.requestPointerLock) {
      canvas.requestPointerLock();
    } else if (canvas.webkitRequestPointerLock) {
      canvas.webkitRequestPointerLock();
    }
  }

  const handleLockClick = () => requestPointerLock();
  const handleFullscreenClick = () => {
    if (getFullscreenElement()) {
      exitFullscreen();
    } else {
      requestFullscreen();
    }
  };
  const handleCanvasClick = () => {
    if (!state.pointerLocked) {
      requestPointerLock();
    }
    if (!state.started) {
      state.started = true;
      pushFeed("鼠标锁定，作战开始");
    }
  };
  const handleCanvasDoubleClick = () => requestFullscreen();
  const handleMouseDown = (event) => {
    if (event.button === 0) {
      input.fireHeld = true;
      if (state.pointerLocked || state.canvasHover) {
        fireWeapon();
      }
    }
  };
  const handleMouseUp = () => {
    input.fireHeld = false;
  };
  const handleMouseMove = (event) => {
    if ((!(state.pointerLocked || state.canvasHover)) || player.dead || player.victorious) {
      return;
    }
    const deltaX = Number.isFinite(event.movementX) ? event.movementX : 0;
    const deltaY = Number.isFinite(event.movementY) ? event.movementY : 0;
    player.yaw -= deltaX * 0.0024;
    player.pitch = clamp(player.pitch - deltaY * 0.0018, -1.1, 1.1);
  };
  const handleCanvasEnter = () => {
    state.canvasHover = true;
  };
  const handleCanvasLeave = () => {
    state.canvasHover = false;
  };
  const handleKeyDown = (event) => {
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "shift", "r", "f", " "].includes(key) || event.key === "Shift") {
      event.preventDefault();
    }
    if (key === "w") input.forward = true;
    if (key === "s") input.backward = true;
    if (key === "a") input.left = true;
    if (key === "d") input.right = true;
    if (key === "shift") input.sprint = true;
    if (key === "r") startReload();
    if (key === "f") {
      if (getFullscreenElement()) {
        exitFullscreen();
      } else {
        requestFullscreen();
      }
    }
  };
  const handleKeyUp = (event) => {
    const key = event.key.toLowerCase();
    if (key === "w") input.forward = false;
    if (key === "s") input.backward = false;
    if (key === "a") input.left = false;
    if (key === "d") input.right = false;
    if (key === "shift") input.sprint = false;
  };

  lockButton.addEventListener("click", handleLockClick);
  fullscreenButton.addEventListener("click", handleFullscreenClick);
  canvas.addEventListener("click", handleCanvasClick);
  canvas.addEventListener("dblclick", handleCanvasDoubleClick);
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mouseenter", handleCanvasEnter);
  canvas.addEventListener("mouseleave", handleCanvasLeave);
  window.addEventListener("mouseup", handleMouseUp);
  document.addEventListener("pointerlockchange", handlePointerLock);
  document.addEventListener("webkitpointerlockchange", handlePointerLock);
  document.addEventListener("fullscreenchange", updateCanvasSize);
  document.addEventListener("webkitfullscreenchange", updateCanvasSize);
  document.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  const removeEvents = () => {
    lockButton.removeEventListener("click", handleLockClick);
    fullscreenButton.removeEventListener("click", handleFullscreenClick);
    canvas.removeEventListener("click", handleCanvasClick);
    canvas.removeEventListener("dblclick", handleCanvasDoubleClick);
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mouseenter", handleCanvasEnter);
    canvas.removeEventListener("mouseleave", handleCanvasLeave);
    window.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("pointerlockchange", handlePointerLock);
    document.removeEventListener("webkitpointerlockchange", handlePointerLock);
    document.removeEventListener("fullscreenchange", updateCanvasSize);
    document.removeEventListener("webkitfullscreenchange", updateCanvasSize);
    document.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
  disposer.add(removeEvents);
  disposer.add(() => clearTimeout(noticeTimer));
  disposer.add(() => {
    if ((document.pointerLockElement || document.webkitPointerLockElement) === canvas) {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      } else if (document.webkitExitPointerLock) {
        document.webkitExitPointerLock();
      }
    }
  });
  disposer.add(() => {
    resources.forEach((resource) => {
      if (!resource) return;
      if (resource.vao && gl.deleteVertexArray) gl.deleteVertexArray(resource.vao);
      (resource.buffers || []).forEach((buffer) => gl.deleteBuffer(buffer));
    });
    weaponResources.forEach((weapon) => {
      if (!weapon.resource) return;
      if (weapon.resource.vao && gl.deleteVertexArray) gl.deleteVertexArray(weapon.resource.vao);
      (weapon.resource.buffers || []).forEach((buffer) => gl.deleteBuffer(buffer));
      if (weapon.texture && weapon.texture !== whiteTexture) {
        gl.deleteTexture(weapon.texture);
      }
    });
    gl.deleteTexture(whiteTexture);
    if (avatarTexture !== whiteTexture) {
      gl.deleteTexture(avatarTexture);
    }
    gl.deleteProgram(program);
  });

  updateCanvasSize();
  updateHud();
  pushFeed("等待锁定鼠标，准备进场");
  spawnWave();

  loadDragonLoreModelData()
    .then((model) => {
      if (disposed) {
        return;
      }
      weaponResources = model.weaponPrimitives.map((primitive) => ({
        resource: fpsCreateMeshResource(gl, programInfo, primitive, renderer),
        texture: primitive.material.textureBitmap ? fpsCreateBitmapTexture(gl, primitive.material.textureBitmap, renderer) : whiteTexture,
        baseColor: primitive.material.baseColorFactor || [1, 1, 1, 1],
        baseMatrix: fpsMat4Identity(),
      }));
      weaponReady = weaponResources.length > 0;
      pushFeed("Dragon Lore 枪模已装载");
      showNotice("龙狙模型已接入", 1400);
    })
    .catch((error) => {
      pushFeed(`模型加载失败：${error.message}`);
      showNotice("模型加载失败", 2200);
    });

  disposer.add(() => {
    disposed = true;
  });

  disposer.raf((dt) => {
    updateCanvasSize();
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateEffects(dt);
    updateProgression(dt);
    updateHud();
    drawMinimap();
    drawWorld();
    drawWeapon();
  });

  return () => disposer.destroy();
}
