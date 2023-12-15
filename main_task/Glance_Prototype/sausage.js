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
`




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
`

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
    u_specular: 0.3,
    u_shininess: 0.4,
    u_lightPos: [0, 5, 5],
    u_lightColor: [0.6, 0.6, 0.6],
    u_projectionMatrix: projectionMatrix,
    u_texDiffuse: 0,
})

const {attributes: platAttr, indices: platIdx} = await glance.loadObj("./obj/platform.obj")

const sizeWorld = [4, 0.1, 4]
const worldpos = [0,-0.25,0]

//const worldIBO = glance.createIndexBuffer(gl, glance.createBoxIndices());
// const worldABO = glance.createAttributeBuffer(gl, "world-abo", glance.createBoxAttributes(sizeWorld, worldpos), {
    //     a_pos: { size: 3, type: gl.FLOAT },
    //     a_normal: { size: 3, type: gl.FLOAT },
    //     a_texCoord: { size: 2, type: gl.FLOAT },
//})

const worldIBO = glance.createIndexBuffer(gl, platIdx);
const worldABO = glance.createAttributeBuffer(gl, "world-abo", platAttr, {
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
//const worldTextureAmbient = glance.loadTexture(gl, "img/ground.avif")
const worldTextureDiffuse = glance.loadTexture(gl, "img/Sand_TextureS.jpg")
//const worldTextureSpecular = glance.loadTexture(gl, "img/ground.avif")

const cubeTextureDiffuse = glance.loadTexture(gl, "img/sauce.avif");
// ----------------------------------------- Cubeeee



const cubeShader = glance.buildShaderProgram(gl, "cube-shader", cubeVertexShader, cubeFragmentShader, {
    u_ambient:0.1,
    u_specular: 0.2,
    u_shininess: 0.5,
    u_lightPos: [0,5,5],
    u_lightColor:[1,1,1],
    u_projectionMatrix: projectionMatrix,
    u_cubeMap: 0,
    u_texShadow: 3,
})



const sizeSmallCube = [0.4, 0.4, 0.4]
const positionSmallCube = [0, 0, 0]
const cubeIBO = glance.createIndexBuffer(gl, glance.createBoxIndices());
const cubeABO = glance.createAttributeBuffer(gl, "cube-abo", glance.createBoxAttributes(sizeSmallCube, positionSmallCube), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
})


const [cubeCubemap, cubeCubeMapLoaded] = glance.loadCubemap(gl, "cube-texture", [
    "img/cubeTex_1.avif",
    "img/cubeTex_2.avif",
    "img/cubeTex_3.avif",
    "img/cubeTex_4.avif",
    "img/cubeTex_5.avif",
    "img/cubeTex_6.avif",
])






const cubeVAO = glance.createVAO(
    gl,
    "cube-vao",
    cubeIBO,
    glance.buildAttributeMap(worldShader, cubeABO, ["a_pos", "a_normal","a_texCoord"])
)


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

/*const [skyCubemap, skyCubeMapLoaded] = glance.loadCubemap(gl, "sky-texture", [
    "img/Skybox_Right.avif",
    "img/Skybox_Left.avif",
    "img/Skybox_Top.avif",
    "img/Skybox_Bottom.avif",
    "img/Skybox_Front.avif",
    "img/Skybox_Back.avif",
])*/

const [skyCubemap, skyCubeMapLoaded] = glance.loadCubemap(gl, "sky-texture", [
    "img/himmel_rechts.jpg",
    "img/himmel_links.jpg",
    "img/himmel_oben.jpg",
    "img/himmel_unten.jpg",
    "img/himmel_vorne.jpg",
    "img/himmel_hinten.jpg",
])



// =============================================================================
// Draw Calls
// =============================================================================


// Scene State
let viewDist = 4.5
let viewPan = 0
let viewTilt = 0

const RotationDirection = {
    LEFT: 'left',
    RIGHT: 'right',
    FORWARD: 'forward',
    BACKWARD: 'backward'
};
let currentRotation = RotationDirection.FORWARD;

let cubeModelMatrix = mat4.identity();



let moveSpeed = 0.15;


const worldDrawCall = glance.createDrawCall(
    gl,
    worldShader,
    worldVAO,
    {
        // uniform update callbacks
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
    [
        // texture bindings
        [0, worldTextureDiffuse]
    ]
)


const cubeDrawCall = glance.createDrawCall(
    gl,
    cubeShader,
    cubeVAO,
    {

        // uniform update callbacks
        u_modelMatrix: (time) => cubeModelMatrix,
        //u_modelMatrix: (time) => mat4.multiply(mat4.identity(), mat4.rotate(mat4.identity(), 5, 1)),
        u_normalMatrix: (time) => mat3.fromMat4(mat4.transpose(mat4.invert(cubeModelMatrix))),
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
        [0, cubeCubemap]
    ],
    () => cubeCubeMapLoaded.isComplete()
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
        [0, skyCubemap]
    ],
    () => skyCubeMapLoaded.isComplete()
)



let cubeRotationMatrix =  mat4.identity();

let xAxis = [1,0,0]
let zAxis = [0,0,1]

function rotateAroundAxis2(degree, axis) {
    let rotationMatrix = 0;
    console.log(currentRotation)
    switch(currentRotation){
        case("backward"):
            rotationMatrix = mat4.fromRotation(degree, xAxis);
            break;
        case("forward"):
            rotationMatrix = mat4.fromRotation(-degree, xAxis);
            break;
        case("right"):
            rotationMatrix = mat4.fromRotation(-degree, zAxis);
            break;
        case("left"):
            rotationMatrix = mat4.fromRotation(degree, zAxis);
            break;
        default:
            break;
    }
    let translatedMatrix = mat4.translate(mat4.identity(), axis);

    // Multiply the input matrix with the translation matrix
    let updatedMatrix = mat4.multiply( mat4.clone(cubeRotationMatrix), translatedMatrix);

    // Multiply the result with the rotation matrix
    updatedMatrix = mat4.multiply(updatedMatrix, rotationMatrix);

    // Multiply the result with the inverse of the translation matrix
    updatedMatrix = mat4.multiply(updatedMatrix, mat4.invert(translatedMatrix));

    return updatedMatrix;
}




// =============================================================================
// System Integration
// =============================================================================

let moveStarted = false;
let startTime = 0
let startedAnimation = false

let rotEnded = false

let backAxis = [0,-0.2,0.2]
let forwardAxis = [0,-0.2,-0.2]
let rightAxis = [0.2,-0.2,0]
let leftAxis = [-0.2,-0.2,0]
let axis = backAxis


function tween(start, end, duration, time) {
        if(!startedAnimation){
            startTime = time
            startedAnimation = true
        }
        const currentTime = time - startTime;
        const t = Math.min(1, currentTime / duration)
        const result = start + t * (end - start)
        if(result == end){
            startedAnimation = false
            moveStarted = false
            rotEnded = true
        }
        return result ;
}




setRenderLoop((time) =>
{
    // One-time WebGL setup
    //gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  
    if(moveStarted){
        let rad = tween(0,Math.PI/2,500,time)       
        cubeModelMatrix = rotateAroundAxis2(rad,axis)
    }

    glance.performDrawCall(gl, cubeDrawCall, time)
    glance.performDrawCall(gl, worldDrawCall, time)
    
    glance.performDrawCall(gl, skyDrawCall, time)

    if(rotEnded){
        
        
        // the Matrix for making rotations is rotated 90 degrees, and new bottom axis will be defined
        cubeRotationMatrix = rotateAroundAxis2(Math.PI/2,axis)

        let x = 0;
        let y = 0;
        let z = 0;
      //  let y = round2Decimals(0.4 * Math.cos(idx * Math.PI/2)) 
      //  let z = round2Decimals(0.4 * Math.sin(idx * (Math.PI/2 - Math.PI))) 
     
        switch(currentRotation){
            case("backward"):
                y = backwardArrayY[idx]
                z = backwardArrayZ[idx]
                break;
            case("forward"):
                y = forwardArrayY[idx]
                z = forwardArrayZ[idx]
                break;
            case("right"):
                x = rightArrayX[idx]
                y = rightArrayY[idx]
                break;
            case("left"):
                x = leftArrayX[idx]
                y = leftArrayY[idx]
                break;
        }
        updateAllAxes(x,y,z)
        
       // axis[1] += y
       // axis[2] += z
       // console.log("y="+y +" z="+z)

        idx++;
        if( idx >=4){
            idx = 0
        }
        rotEnded = false
    }
})

let forwardArrayY = [0.4, 0, -0.4, 0]
let forwardArrayZ = [0, 0.4, 0, -0.4]
let backwardArrayY = [0.4, 0, -0.4, 0]
let backwardArrayZ = [0, -0.4, 0, 0.4] 
let leftArrayY = [0.4, 0, -0.4, 0]
let leftArrayX = [0, 0.4, 0, -0.4] 
let rightArrayY = [0.4, 0, -0.4, 0]
let rightArrayX = [0, -0.4, 0, 0.4] 


function updateAllAxes(_x = 0,_y= 0,_z=0){
    backAxis[0] += _x
    backAxis[1] += _y
    backAxis[2] += _z

    forwardAxis[0] += _x
    forwardAxis[1] += _y
    forwardAxis[2] += _z

    rightAxis[0] += _x
    rightAxis[1] += _y
    rightAxis[2] += _z

    leftAxis[0] += _x
    leftAxis[1] += _y
    leftAxis[2] += _z
}

let idx = 0;


function round2Decimals(value){
    return  Math.round(value * 100) / 100
}


onMouseDrag((e) =>
{
    viewPan += e.movementX * -.01
    viewTilt += e.movementY * -.01
})



viewTilt = 75
viewDist = 8

onMouseWheel((e) =>
{
    viewDist = Math.max(1.5, Math.min(10, viewDist * (1 + Math.sign(e.deltaY) * 0.2)))
})

onKeyDown((e)=>
 {
    // Access the pressed key using event.key
    switch (e.key) {
        case "a":
            if (currentRotation != "left"){
                idx = 0;
            }
            currentRotation = RotationDirection.LEFT
            axis = leftAxis
            moveStarted = true;
            break;
        case "d":
            if (currentRotation != "right"){
                idx = 0;
            }
            currentRotation = RotationDirection.RIGHT
            axis = rightAxis
            moveStarted = true;
            break;
        case "s":
            if (currentRotation != "backward"){
                idx = 0;
            }
            currentRotation = RotationDirection.BACKWARD
            axis = backAxis
            moveStarted = true;
            break;
        case "w":
            if (currentRotation != "forward"){
                idx = 0;
            }
            currentRotation = RotationDirection.FORWARD
            axis = forwardAxis
            moveStarted = true;
            break;
    }
})