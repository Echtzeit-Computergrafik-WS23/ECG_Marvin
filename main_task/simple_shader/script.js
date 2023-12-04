////////////////////////////////////////////////////////////////////////////////
// BOILERPLATE START

// Get the WebGL context

function setUpWebGl(){
    const canvas  = document.getElementById('canvas')
    const gl = canvas.getContext('webgl2')
    return gl
}

const gl = setUpWebGl();



// Add mouse move event handlers to the canvas to update the cursor[] array.
const cursor = [0, 0]
canvas.addEventListener('mousemove', (event) =>
{
    cursor[0] = (event.offsetX / canvas.width) * 2 - 1
    cursor[1] = (event.offsetY / canvas.height) * -2 + 1
})

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

// BOILERPLATE END
////////////////////////////////////////////////////////////////////////////////
// Shader //////////////////////////////////////////////////////////////////////

const vertexShaderSource = `#version 300 es
    precision highp float; // Calculate the varying outputs with high precision

    in vec2 a_pos;
    in vec3 a_color;

    out vec3 f_color;

    void main() {
         gl_Position = vec4(a_pos, 0.0, 1.0);
         f_color = a_color;
    }
`
//"reveal-cursor"
const fragmentShaderSource1 =`#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_cursor;


in vec3 f_color;

out vec4 FragColor;



void main() {
 
    vec3 backgroundColor = vec3(0.0, 0.0, 0.0); 
    vec2 fragCoord = (gl_FragCoord.xy / 512.0) * 2.0 - vec2(1.0);
    
    vec2 delta = fragCoord - u_cursor;
    float dist = length(delta);
    float inCursor = smoothstep(0.0, 0.2, dist);

    vec3 finalColor = mix(f_color, backgroundColor, inCursor);
    FragColor = vec4(finalColor, 1.0);
}
`;

//"loading-Reveal"
const fragmentShaderSource = `#version 300 es
    precision mediump float;

    uniform float u_time;
    uniform vec2 u_cursor;
      
    in vec3 f_color;
    
    out vec4 FragColor;

    void main() {

        // schwarzer hintergrund
        vec3 backgroundColor = vec3(0.0, 0.0, 0.0);
      
        float sineWave = sin(u_time * 10.0);
        float cosWave =  cos(u_time * 10.0);

        vec2 fragCoord = (gl_FragCoord.xy / 512.0) * 2.0 - vec2(1.0);
        // punkt der sich nach oben und untern bewegt
        vec2 point = vec2(cosWave,sineWave);
        vec2 delta = fragCoord - point;
        float dist = length(delta);
    
        //"radius" der sich ebenfalls über zeit anpasst
        float radius = 0.5 * sineWave +0.52;
        float inPoint = smoothstep(0.0,radius, dist);
    
        vec3 finalColor = mix(f_color, backgroundColor, inPoint);
        FragColor = vec4(finalColor, 1.0);
    }
`;





function makeShader(source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compilation error");
        console.log(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}


// Create the Vertex Shader
const vertexShader = makeShader(vertexShaderSource,gl.VERTEX_SHADER)


// Create the Fragment Shader
const fragmentShader = makeShader(fragmentShaderSource,gl.FRAGMENT_SHADER)


// Link the two into a single Shader Program
const shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)
gl.useProgram(shaderProgram)

// Data ////////////////////////////////////////////////////////////////////////

const vertexPositions = new Float32Array([
    -1., -1., 1, 0, 0,
    +1., -1., 0, 1, 0,
    +1., +1., 0, 0, 1,
    -1., +1., 1, 1, 1,
])

// Create the position buffer
const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW)

const faceIndices = new Uint16Array([
    0, 1, 2, // first triangle
    0, 2, 3, // second triangle
])

// Create the index buffer
const indexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW)

// Attribute Mapping ///////////////////////////////////////////////////////////

// Map the contents of the buffer to the vertex shader
const vertexAttribute = gl.getAttribLocation(shaderProgram, 'a_pos')
gl.enableVertexAttribArray(vertexAttribute)
gl.vertexAttribPointer(
    vertexAttribute,
    2,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    20,       // stride
    0         // offset
)

const colorAttribute = gl.getAttribLocation(shaderProgram, 'a_color')
gl.enableVertexAttribArray(colorAttribute)
gl.vertexAttribPointer(
    colorAttribute,
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    20,       // stride
    8         // offset
)

// Uniforms ////////////////////////////////////////////////////////////////////

const timeUniform = gl.getUniformLocation(shaderProgram, "u_time")
const cursorUniform = gl.getUniformLocation(shaderProgram, "u_cursor")

// Rendering ///////////////////////////////////////////////////////////////////

function renderLoop(time)
{
    gl.uniform1f(timeUniform, time / 5000)
    gl.uniform2f(cursorUniform, cursor[0], cursor[1])

    // Draw the scene.
    gl.drawElements(
        gl.TRIANGLES,       // primitive type
        faceIndices.length, // vertex count
        gl.UNSIGNED_SHORT,  // type of indices
        0                   // offset
    )
}
setRenderLoop(renderLoop)