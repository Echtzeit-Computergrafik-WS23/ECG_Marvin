////////////////////////////////////////////////////////////////////////////////
// START OF BOILERPLATE CODE ///////////////////////////////////////////////////

// Get the WebGL context
const canvas = document.getElementById('canvas')
const gl = canvas.getContext('webgl2')

// Add mouse move event handlers to the canvas to update the cursor[] array.
const cursor = [0, 0]
canvas.addEventListener('mousemove', (event) =>
{
    cursor[0] = (event.offsetX / canvas.width) * 2 - 1
    cursor[1] = (event.offsetY / canvas.height) * -2 + 1
})



function onMouseDrag(callback)
{
    canvas.addEventListener('pointerdown', () =>
    {
        const stopDrag = () =>
        {
            canvas.removeEventListener("pointermove", callback)
            canvas.removeEventListener("pointerup", stopDrag)
            canvas.removeEventListener("pointerleave", stopDrag)
        }

        canvas.addEventListener('pointermove', callback)
        canvas.addEventListener("pointerup", stopDrag, { once: true })
        canvas.addEventListener("pointerleave", stopDrag, { once: true })
    })
}

function onMouseWheel(callback)
{
    canvas.addEventListener('wheel', callback)
}



function onKeyDown(callback)
{
    canvas.addEventListener('keydown', callback)
}

function onKeyUp(callback)
{
    canvas.addEventListener('keyup', callback)
}



// Basic render loop manager.
function setRenderLoop(callback)
{
    function renderLoop(time)
    {
        if (setRenderLoop._callback !== null) {
            setRenderLoop._callback(time)
            requestAnimationFrame(renderLoop)
        }
    }
    setRenderLoop._callback = callback
    requestAnimationFrame(renderLoop)
}
setRenderLoop._callback = null

import glance from './js/glance.js'

// BOILERPLATE END
////////////////////////////////////////////////////////////////////////////////

const {
    vec3,
    mat3,
    mat4,
} = glance


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
`


const worldFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightPos;
    uniform vec3 u_lightColor;
    uniform vec3 u_viewPos;
    uniform sampler2D u_texAmbient;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;

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
`




const cubeVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat3 u_normalMatrix;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_cubePos;
    out vec3 f_normal;
    out vec2 f_texCoord;

    void main() {
        f_cubePos = vec3(u_modelMatrix * vec4(a_pos, 1.0));
        f_normal = u_normalMatrix * a_normal;
        f_texCoord = a_texCoord;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_pos, 1.0);
    }
`

const cubeFragmentShader = `#version 300 es
    precision mediump float;

    uniform vec3 u_ambientColor;
    uniform float u_ambientIntensity;
    uniform vec3 u_lightPos;
    uniform vec3 u_lightColor;
    uniform sampler2D u_texDiffuse;

    in vec3 f_cubePos;
    in vec3 f_normal;
    in vec2 f_texCoord;

    out vec4 FragColor;

    void main() {

        // texture
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;

        // diffuse
        vec3 normal = normalize(f_normal);
        vec3 lightDir = normalize(u_lightPos - f_cubePos);
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // ambient
        vec3 ambient = u_ambientColor * u_ambientIntensity * texDiffuse;

        // color
        FragColor = vec4(ambient + diffuse, 1.0);
}
`


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
`




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
`


// =============================================================================
// Data
// =============================================================================


const projectionMatrix = mat4.perspective(Math.PI / 4, 1, 0.1, 14)


//----------------------------------------------------------- The world
const worldShader = glance.buildShaderProgram(gl, "world-shader", worldVertexShader, worldFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.6,
    u_shininess: 64,
    u_lightPos: [0, 5, 5],
    u_lightColor: [1, 1, 1],
    u_projectionMatrix: projectionMatrix,
    u_texAmbient: 0,
    u_texDiffuse: 1,
    u_texSpecular: 2,
})


const sizeWorld = [3, 0.1, 3]
const wordlpos = [0,0,0]
const worldIBO = glance.createIndexBuffer(gl, glance.createBoxIndices());
const worldABO = glance.createAttributeBuffer(gl, "world-abo", glance.createBoxAttributes(sizeWorld, wordlpos), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
})
const worldVAO = glance.createVAO(
    gl,
    "world-vao",
    worldIBO,
    glance.buildAttributeMap(worldShader, worldABO, ["a_pos", "a_normal","a_texCoord"])
)
const worldTextureAmbient = glance.loadTexture(gl, "img/ground.avif")
const worldTextureDiffuse = glance.loadTexture(gl, "img/ground.avif")
const worldTextureSpecular = glance.loadTexture(gl, "img/ground.avif")

const cubeTextureDiffuse = glance.loadTexture(gl, "img/sauce.avif");
// ----------------------------------------- Cubeeee
const sizeSmallCube = [0.4, 0.4, 0.4]
const positionSmallCube = [0, 0.25, 0]
const cubeIBO = glance.createIndexBuffer(gl, glance.createBoxIndices());
const cubeABO = glance.createAttributeBuffer(gl, "cube-abo", glance.createBoxAttributes(sizeSmallCube, positionSmallCube), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
})
const cubeVAO = glance.createVAO(
    gl,
    "cube-vao",
    cubeIBO,
    glance.buildAttributeMap(worldShader, cubeABO, ["a_pos", "a_normal","a_texCoord"])
)


const [cubeCubemap, cubeCubeMapLoaded] = glance.loadCubemap(gl, "cube-texture", [
    "img/cubeTex_1.avif",
    "img/cubeTex_2.avif",
    "img/cubeTex_3.avif",
    "img/cubeTex_4.avif",
    "img/cubeTex_5.avif",
    "img/cubeTex_6.avif",
])



// -------------------------------------------The skybox
const skyShader = glance.buildShaderProgram(gl, "sky-shader", skyVertexShader, skyFragmentShader, {
    u_projectionMatrix: projectionMatrix,
    u_skybox: 0,
})

const skyIBO = glance.createIndexBuffer(gl, glance.createSkyBoxIndices())

const skyABO = glance.createAttributeBuffer(gl, "sky-abo", glance.createSkyBoxAttributes(), {
    a_pos: { size: 3, type: gl.FLOAT },
})

const skyVAO = glance.createVAO(gl, "sky-vao", skyIBO, glance.buildAttributeMap(skyShader, skyABO, ["a_pos"]))

const [skyCubemap, skyCubeMapLoaded] = glance.loadCubemap(gl, "sky-texture", [
    "img/himmel_rechts.png",
    "img/himmel_links.png",
    "img/himmel_oben.png",
    "img/himmel_unten.png",
    "img/himmel_vorne.png",
    "img/himmel_hinten.png",
])





// =============================================================================
// Draw Calls
// =============================================================================


// Scene State
let viewDist = 4.5
let viewPan = 0
let viewTilt = 0

let moveX = 0;
let moveZ = 0;
let posX = 0;
let posZ = 0;


let moveSpeed = 0.05;


const worldDrawCall = glance.createDrawCall(
    gl,
    worldShader,
    worldVAO,
    {
        // uniform update callbacks
        u_modelMatrix: (time) => mat4.multiply(mat4.identity(), mat4.fromRotation(1, [0, 1, 0])),
        u_normalMatrix: (time) => mat3.fromMat4(mat4.transpose(mat4.invert(mat4.multiply(mat4.identity(), mat4.fromRotation(1, [0, 1, 0]))))),
        u_viewMatrix: () => mat4.invert(mat4.multiply(mat4.multiply(
            mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
            mat4.fromRotation(viewTilt, [1, 0, 0])
        ), mat4.fromTranslation([0, 0, viewDist]))),
        u_viewPos: () => vec3.transformMat4(vec3.zero(), mat4.multiply(mat4.multiply(
            mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
            mat4.fromRotation(viewTilt, [1, 0, 0])
        ), mat4.fromTranslation([0, 0, viewDist]))),
    },
    [
        // texture bindings
        [0, worldTextureAmbient],
        [1, worldTextureDiffuse],
        [2, worldTextureSpecular],
    ]
)


const cubeDrawCall = glance.createDrawCall(
    gl,
    worldShader,
    cubeVAO,
    {

        // uniform update callbacks
        u_modelMatrix: (time) => mat4.multiply(mat4.identity(), mat4.translate(mat4.identity(), [posX, 0, posZ])),
        u_normalMatrix: (time) => mat3.fromMat4(mat4.transpose(mat4.invert(mat4.multiply(mat4.identity(), mat4.translate(mat4.identity(), [posX, 0, posZ]))))),
        u_viewMatrix: () => mat4.invert(mat4.multiply(mat4.multiply(
            mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
            mat4.fromRotation(viewTilt, [1, 0, 0])
        ), mat4.fromTranslation([0, 0, viewDist]))),
        u_viewPos: () => vec3.transformMat4(vec3.zero(), mat4.multiply(mat4.multiply(
            mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
            mat4.fromRotation(viewTilt, [1, 0, 0])
        ), mat4.fromTranslation([0, 0, viewDist]))),
    },
    [
        // texture bindings
        [0, cubeTextureDiffuse],
        [1, cubeTextureDiffuse],
        [2, cubeTextureDiffuse],
    ]
)




const skyDrawCall = glance.createDrawCall(
    gl,
    skyShader,
    skyVAO,
    {
        // uniform update callbacks
        u_viewRotationMatrix: () => mat3.fromMat4(mat4.multiply(
            mat4.multiply(mat4.identity(), mat4.fromRotation(viewPan, [0, 1, 0])),
            mat4.fromRotation(viewTilt, [1, 0, 0])
        )),
    },
    [
        // texture bindings
        [0, skyCubemap],
    ],
    () => skyCubeMapLoaded.isComplete()
)





// =============================================================================
// System Integration
// =============================================================================

setRenderLoop((time) =>
{
    // One-time WebGL setup
    //gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    glance.performDrawCall(gl, worldDrawCall, time)
    glance.performDrawCall(gl, cubeDrawCall, time)
    glance.performDrawCall(gl, skyDrawCall, time)
})

onMouseDrag((e) =>
{
    viewPan += e.movementX * -.01
    viewTilt += e.movementY * -.01
})

onMouseWheel((e) =>
{
    viewDist = Math.max(1.5, Math.min(10, viewDist * (1 + Math.sign(e.deltaY) * 0.2)))
})

onKeyDown((e)=>
 {
    // Access the pressed key using event.key
    switch (e.key) {
        case "a":
            moveX = - 1;
            moveZ = 0;
            break;
        case "d":
            moveX = 1;
            moveZ = 0;
            break;
        case "s":
            moveX = 0;
            moveZ =  1;
            break;
        case "w":
            moveX = 0;
            moveZ = -1;
            break;
    }

    posX += moveX * moveSpeed;
    posZ += moveZ * moveSpeed;
});