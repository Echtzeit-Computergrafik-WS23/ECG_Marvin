////////////////////////////////////////////////////////////////////////////////
// START OF BOILERPLATE CODE ///////////////////////////////////////////////////

// Get the WebGL context
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

// Add mouse move event handlers to the canvas to update the cursor[] array.
const cursor = [0, 0];
canvas.addEventListener('mousemove', (event) =>
{
    cursor[0] = (event.offsetX / canvas.width) * 2 - 1;
    cursor[1] = (event.offsetY / canvas.height) * -2 + 1;
});

function onMouseDrag(callback)
{
    canvas.addEventListener('pointerdown', () =>
    {
        const stopDrag = () =>
        {
            canvas.removeEventListener("pointermove", callback);
            canvas.removeEventListener("pointerup", stopDrag);
            canvas.removeEventListener("pointerleave", stopDrag);
        };

        canvas.addEventListener('pointermove', callback);
        canvas.addEventListener("pointerup", stopDrag, { once: true });
        canvas.addEventListener("pointerleave", stopDrag, { once: true });
    });
}

function onMouseWheel(callback)
{
    canvas.addEventListener('wheel', callback);
}

function onKeyDown(callback)
{
    canvas.addEventListener('keydown', callback);
}

function onKeyUp(callback)
{
    canvas.addEventListener('keyup', callback);
}

// Basic render loop manager.
function setRenderLoop(callback)
{
    function renderLoop(time)
    {
        if (setRenderLoop._callback !== null) {
            setRenderLoop._callback(time);
            requestAnimationFrame(renderLoop);
        }
    }
    setRenderLoop._callback = callback;
    requestAnimationFrame(renderLoop);
}
setRenderLoop._callback = null;

import glance from './js/glance.js';

// BOILERPLATE END
////////////////////////////////////////////////////////////////////////////////

const {
    vec3,
    mat3,
    mat4,
} = glance;

// =============================================================================
// Constants
// =============================================================================

const moveSpeed = 0.01;
const cubeSize = 0.4;

// =============================================================================
// Shader Code
// =============================================================================

const worldVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat3 u_normalMatrix;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_worldPos;
    out vec3 f_normal;
    out vec2 f_texCoord;

    void main() {
        f_worldPos = vec3(u_modelMatrix * vec4(a_pos, 1.0));
        f_normal = u_normalMatrix * a_normal;
        f_texCoord = a_texCoord;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_pos, 1.0);
    }
`;

const worldFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightPos;
    uniform vec3 u_lightColor;
    uniform vec3 u_viewPos;
    uniform sampler2D u_texDiffuse;

    in vec3 f_worldPos;
    in vec3 f_normal;
    in vec2 f_texCoord;

    out vec4 FragColor;

    void main() {

        // texture
        vec3 texAmbient = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texDiffuse, f_texCoord).rgb;

        // ambient
        vec3 ambient = max(vec3(u_ambient), texAmbient) * texDiffuse;

        // diffuse
        vec3 normal = normalize(f_normal);
        vec3 lightDir = normalize(u_lightPos - f_worldPos);
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(u_viewPos - f_worldPos);
        vec3 halfWay = normalize(lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // color
        FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
`;

const cubeVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat3 u_normalMatrix;

    in vec3 a_pos;
    in vec3 a_normal;


    out vec3 f_cubePos;
    out vec3 f_normal;
    out vec3 f_texCoord;

    void main() {
        f_cubePos = vec3(u_modelMatrix * vec4(a_pos, 1.0));
        f_normal = u_normalMatrix * a_normal;
        f_texCoord = a_pos;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_pos, 1.0);
    }
`;

const cubeFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightPos;
    uniform vec3 u_lightColor;
    uniform vec3 u_viewPos;

    uniform samplerCube u_cubeMap;

    in vec3 f_cubePos;
    in vec3 f_normal;
    in vec3 f_texCoord;

    out vec4 FragColor;

    void main() {
        // texture
        vec3 texAmbient = texture(u_cubeMap, f_texCoord).rgb;
        vec3 texDiffuse = texture(u_cubeMap, f_texCoord).rgb;
        vec3 texSpecular = texture(u_cubeMap, f_texCoord).rgb;

        // ambient
        vec3 ambient = max(vec3(u_ambient), texAmbient) * texDiffuse;

        // diffuse
        vec3 normal = normalize(f_normal);
        vec3 lightDir = normalize(u_lightPos - f_cubePos);
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(u_viewPos - f_cubePos);
        vec3 halfWay = normalize(lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // color
        FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
`;

const skyVertexShader = `#version 300 es
    precision highp float;

    uniform mat3 u_viewRotationMatrix;
    uniform mat4 u_projectionMatrix;

    in vec3 a_pos;

    out vec3 f_texCoord;

    void main() {
        // Use the local position of the vertex as texture coordinate.
        f_texCoord = a_pos;

        // By setting Z == W, we ensure that the vertex is projected onto the
        // far plane, which is exactly what we want for the background.
        vec4 ndcPos = u_projectionMatrix * inverse(mat4(u_viewRotationMatrix)) * vec4(a_pos, 1.0);
        gl_Position = ndcPos.xyww;
    }
`;

const skyFragmentShader = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 FragColor;

    void main() {
        // The fragment color is simply the color of the skybox at the given
        // texture coordinate (local coordinate) of the fragment on the cube.
        FragColor = texture(u_skybox, f_texCoord);
    }
`;

// =============================================================================
// Data
// =============================================================================

const projectionMatrix = mat4.perspective(Math.PI / 4, 1, 0.1, 14);

//----------------------------------------------------------- The world
const worldShader = glance.buildShaderProgram(gl, "world-shader", worldVertexShader, worldFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.3,
    u_shininess: 0.4,
    u_lightPos: [0, 5, 5],
    u_lightColor: [0.6, 0.6, 0.6],
    u_projectionMatrix: projectionMatrix,
    u_texDiffuse: 0,
});

const { attributes: platAttr, indices: platIdx } = await glance.loadObj("obj/platform.obj");

const sizeWorld = [4, 0.1, 4];
const worldpos = [0, -0.25, 0];

const worldIBO = glance.createIndexBuffer(gl, platIdx);
const worldABO = glance.createAttributeBuffer(gl, "world-abo", platAttr, {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
});

const worldVAO = glance.createVAO(
    gl,
    "world-vao",
    worldIBO,
    glance.buildAttributeMap(worldShader, worldABO, ["a_pos", "a_normal", "a_texCoord"])
);

const worldTextureDiffuse = await glance.loadTextureNow(gl, "img/Sand_TextureS.jpg");
const cubeTextureDiffuse = await glance.loadTextureNow(gl, "img/sauce.avif");

// ----------------------------------------- Cubeeee

const cubeShader = glance.buildShaderProgram(gl, "cube-shader", cubeVertexShader, cubeFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.2,
    u_shininess: 0.5,
    u_lightPos: [0, 5, 5],
    u_lightColor: [1, 1, 1],
    u_projectionMatrix: projectionMatrix,
    u_cubeMap: 0,
});

const cubeIBO = glance.createIndexBuffer(gl, glance.createBoxIndices());
const cubeABO = glance.createAttributeBuffer(gl, "cube-abo", glance.createBoxAttributes(cubeSize), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
});

const cubeCubemap = await glance.loadCubemapNow(gl, "cube-texture", [
    "img/cubeTex_1.avif",
    "img/cubeTex_2.avif",
    "img/cubeTex_3.avif",
    "img/cubeTex_4.avif",
    "img/cubeTex_5.avif",
    "img/cubeTex_6.avif",
]);

const cubeVAO = glance.createVAO(
    gl,
    "cube-vao",
    cubeIBO,
    glance.buildAttributeMap(worldShader, cubeABO, ["a_pos", "a_normal", "a_texCoord"])
);

// -------------------------------------------The skybox

const skyShader = glance.buildShaderProgram(gl, "sky-shader", skyVertexShader, skyFragmentShader, {
    u_projectionMatrix: projectionMatrix,
    u_skybox: 0,
});

const skyIBO = glance.createIndexBuffer(gl, glance.createSkyBoxIndices());

const skyABO = glance.createAttributeBuffer(gl, "sky-abo", glance.createSkyBoxAttributes(), {
    a_pos: { size: 3, type: gl.FLOAT },
});

const skyVAO = glance.createVAO(gl, "sky-vao", skyIBO, glance.buildAttributeMap(skyShader, skyABO, ["a_pos"]));

const skyCubemap = await glance.loadCubemapNow(gl, "sky-texture", [
    "img/himmel_rechts.jpg",
    "img/himmel_links.jpg",
    "img/himmel_oben.jpg",
    "img/himmel_unten.jpg",
    "img/himmel_vorne.jpg",
    "img/himmel_hinten.jpg",
]);

// =============================================================================
// Draw Calls
// =============================================================================

const worldDrawCall = glance.createDrawCall(
    gl,
    worldShader,
    worldVAO,
    {

        uniforms: {
            u_modelMatrix: (time) => mat4.identity(),
            u_normalMatrix: (time) => mat3.fromMat4(mat4.transpose(mat4.invert(mat4.identity()))),
            u_viewMatrix: () => mat4.invert(mat4.multiply(mat4.multiply(
                mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
                mat4.fromRotation(viewTilt, [1, 0, 0])
            ), mat4.fromTranslation([0, 0, viewDist]))),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), mat4.multiply(mat4.multiply(
                mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
                mat4.fromRotation(viewTilt, [1, 0, 0])
            ), mat4.fromTranslation([0, 0, viewDist]))),
        },
        textures: [
            [0, worldTextureDiffuse]
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const cubeDrawCall = glance.createDrawCall(
    gl,
    cubeShader,
    cubeVAO,
    {
        uniforms: {
            u_modelMatrix: () => cubeXform,
            u_normalMatrix: () => mat3.fromMat4(cubeXform),
            u_viewMatrix: () => mat4.invert(mat4.multiply(mat4.multiply(
                mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
                mat4.fromRotation(viewTilt, [1, 0, 0])
            ), mat4.fromTranslation([0, 0, viewDist]))),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), mat4.multiply(mat4.multiply(
                mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
                mat4.fromRotation(viewTilt, [1, 0, 0])
            ), mat4.fromTranslation([0, 0, viewDist]))),
        },
        textures: [
            [0, cubeCubemap]
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    },
);

const skyDrawCall = glance.createDrawCall(
    gl,
    skyShader,
    skyVAO,
    {
        uniforms: {
            u_viewRotationMatrix: () => mat3.fromMat4(mat4.multiply(
                mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
                mat4.fromRotation(viewTilt, [1, 0, 0])
            )),
        },
        textures: [
            [0, skyCubemap]
        ],
        depthTest: gl.LEQUAL,
    }
);

// =============================================================================
// System Integration
// =============================================================================

// Scene State
let viewDist = 8;
let viewPan = 0;
let viewTilt = 75;

// Store the Cube State in 2 variables, this will make it easier to animate them
// individually.
let cubePosition = [0, 0, 0];
let cubeOrientation = mat4.identity();
// The complete transformation matrix of the cube is then calculated by combining
// the rotation and translation.
let cubeXform = mat4.identity();

let stepProgress = null;
let stepDirection = null;

function updateCubeState(deltaTime)
{
    // If there is no animation happening, there is nothing to update.
    if (stepProgress === null) {
        return;
    }

    // Advance the animation.
    stepProgress += deltaTime * moveSpeed;
    
    const rotationAxis = vec3.rotateY(vec3.clone(stepDirection), Math.PI * 0.5);

    // If we have finished the animation, update the rest position and orientation
    // of the cube.
    if (stepProgress >= 1.0) {
        cubeOrientation = mat4.multiply(mat4.fromRotation(Math.PI * 0.5, rotationAxis), cubeOrientation);
        cubePosition = vec3.add(cubePosition, vec3.scale(stepDirection, cubeSize));
        cubeXform = mat4.multiply(mat4.fromTranslation(cubePosition), cubeOrientation);

        stepProgress = null;
    }

    // If the animation is still in progress, do not touch the "rest" position and
    // orientiation, only the combined xform.
    else {
        // Calculate the rotation from the "rest" orientation to get the animated orientation
        const rotation = mat4.fromRotation(Math.PI * 0.5 * stepProgress, rotationAxis);

        // Calculate the position of the axis relative to the center of the cube.
        // We first translate the cube by this offset to place the axis at the origin,
        // then rotate the cube around the axis, and then translate it back.
        const axisOffset = vec3.scale(vec3.subtract([0, 1, 0], stepDirection), cubeSize * 0.5);

        // Going backwards:
        // [1]: Start with the "rest" orientation of the cube
        // [2]: Translate the cube by the axis offset
        // [3]: Rotate the cube around the axis
        // [4]: Translate the cube back by the axis offset
        // [5]: Translate the cube to its final position in the scene
        cubeXform = mat4.multiply(
            mat4.fromTranslation(vec3.subtract(vec3.clone(cubePosition), axisOffset)), // [4 + 5]
            mat4.multiply(
                rotation, // [3]
                mat4.multiply(
                    mat4.fromTranslation(axisOffset), // [2]
                    cubeOrientation, // [1]
                ),
            )
        );
    }
}

let lastTime = 0;
setRenderLoop((time) =>
{
    const deltaTime = time - lastTime;
    lastTime = time;

    updateCubeState(deltaTime);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    glance.performDrawCall(gl, cubeDrawCall, time);
    glance.performDrawCall(gl, worldDrawCall, time);
    glance.performDrawCall(gl, skyDrawCall, time);
});

onKeyDown((e) =>
{
    // Ignore the key if the box is already moving.
    if (stepProgress !== null) {
        return;
    }

    // Set the move direction based on the key.
    switch (e.key) {
        case "a":
            stepDirection = [-1, 0, 0];
            break;
        case "d":
            stepDirection = [1, 0, 0];
            break;
        case "s":
            stepDirection = [0, 0, 1];
            break;
        case "w":
            stepDirection = [0, 0, -1];
            break;
        default:
            return;
    }

    // Start the animation, if one of the four movement keys was pressed.
    stepProgress = 0;
});

onMouseDrag((e) =>
{
    viewPan += e.movementX * -.01;
    viewTilt += e.movementY * -.01;
});

onMouseWheel((e) =>
{
    viewDist = Math.max(1.5, Math.min(10, viewDist * (1 + Math.sign(e.deltaY) * 0.2)));
});

