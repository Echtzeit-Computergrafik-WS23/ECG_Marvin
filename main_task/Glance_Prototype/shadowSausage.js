////////////////////////////////////////////////////////////////////////////////
// START OF BOILERPLATE CODE ///////////////////////////////////////////////////

console.log('Hello, WebGL!');

// Get the WebGL context
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

var toggle = document.getElementById('effektCheckbox');


// Add mouse move event handlers to the canvas to update the cursor[] array.
const cursor = [0, 0];
canvas.addEventListener('mousemove', (event) => {
    cursor[0] = (event.offsetX / canvas.width) * 2 - 1;
    cursor[1] = (event.offsetY / canvas.height) * -2 + 1;
});

function onMouseDrag(callback) {
    canvas.addEventListener('pointerdown', () => {
        const stopDrag = () => {
            canvas.removeEventListener("pointermove", callback);
            canvas.removeEventListener("pointerup", stopDrag);
            canvas.removeEventListener("pointerleave", stopDrag);
        };

        canvas.addEventListener('pointermove', callback);
        canvas.addEventListener("pointerup", stopDrag, { once: true });
        canvas.addEventListener("pointerleave", stopDrag, { once: true });
    });
}

function onMouseWheel(callback) {
    canvas.addEventListener('wheel', callback);
}

function onKeyDown(callback) {
    canvas.addEventListener('keydown', callback);
}

function onKeyUp(callback) {
    canvas.addEventListener('keyup', callback);
}

// Basic render loop manager.
function setRenderLoop(callback) {
    function renderLoop(time) {
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

const moveSpeed = 0.0035;
const cubeSize = 0.4;

// =============================================================================
// Shader Code
// =============================================================================

// Solids ----------------------------------------------------------------------

const solidVertexShader = `#version 300 es
    precision highp float;

    uniform mat3 u_invLightRotation;
    uniform mat4 u_lightXform;
    uniform mat4 u_lightProjection;
    uniform mat4 u_viewXform;
    uniform mat4 u_cameraProjection;
    uniform vec3 u_viewPos;
    uniform mat4 u_modelMatrix;
    uniform mat3 u_normalMatrix;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec3 a_tangent;
    in vec2 a_texCoord;

    out vec3 f_posTangentSpace;
    out vec4 f_posLightSpace;
    out vec3 f_lightDir;
    out vec3 f_viewPos;
    out vec2 f_texCoord;

    void main() {
        vec3 normal = u_normalMatrix * a_normal;
        vec3 tangent = u_normalMatrix * a_tangent;
        vec3 bitangent = cross(normal, tangent);
        mat3 tbn = transpose(mat3(tangent, bitangent, normal));

        // Transform world space coords to light space
        vec4 worldSpace = u_modelMatrix * vec4(a_pos, 1.0);
        f_posLightSpace = u_lightProjection * u_lightXform * worldSpace;

        // Transform world space coords to tangent space
        f_posTangentSpace = tbn * vec3(worldSpace);
        f_viewPos = tbn * u_viewPos;
        f_lightDir = tbn * u_invLightRotation * vec3(.0, .0, -1.0);

        f_texCoord = a_texCoord;

        gl_Position = u_cameraProjection * u_viewXform * worldSpace;
    }
`;

const solidFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightColor;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;
    uniform sampler2D u_texNormal;
    uniform mediump sampler2DShadow u_texShadow;

    in vec3 f_posTangentSpace;
    in vec4 f_posLightSpace;
    in vec3 f_lightDir;
    in vec3 f_viewPos;
    in vec2 f_texCoord;

    out vec4 FragColor;

    float calculateShadow();

    void main() {

        // texture
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, f_texCoord).rgb;
        vec3 texNormal = texture(u_texNormal, f_texCoord).rgb;

        // ambient
        vec3 ambient = texDiffuse * u_ambient;

        // diffuse
        vec3 normal = normalize( // only apply the normal map at half strength
            mix(vec3(0., 0., 1.),
            texNormal * (255./128.) - 1.0,
            0.5));
        float diffuseIntensity = max(dot(normal, f_lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(f_viewPos - f_posTangentSpace);
        vec3 halfWay = normalize(f_lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // shadow
        float shadow = calculateShadow();

        // color
        FragColor = vec4(ambient + shadow * (diffuse + specular), 1.0);
    }

    // Returns a "random" number based on a vec3 and an int.
    float random(vec3 seed, int i){
        vec4 seed4 = vec4(seed,i);
        float dot_product = dot(seed4, vec4(12.9898,78.233,45.164,94.673));
        return fract(sin(dot_product) * 43758.5453);
    }

    float calculateShadow() {
        // Perspective divide.
        vec3 projCoords = f_posLightSpace.xyz / f_posLightSpace.w;

        // No shadow for fragments outside of the light's frustum.
        if(any(lessThan(projCoords, vec3(0))) || any(greaterThan(projCoords, vec3(1)))){
            return 1.0;
        }

        // Determine the bias based on the angle of the light hitting the texture
        float bias = max(0.05 * (1.0 - dot(vec3(0.0, 0.0, 1.0), f_lightDir)), 0.005);

        // Get the closest depth value from light's perspective.
        const vec2 poissonDisk[16] = vec2[](
            vec2( -0.94201624, -0.39906216 ),
            vec2( 0.94558609, -0.76890725 ),
            vec2( -0.094184101, -0.92938870 ),
            vec2( 0.34495938, 0.29387760 ),
            vec2( -0.91588581, 0.45771432 ),
            vec2( -0.81544232, -0.87912464 ),
            vec2( -0.38277543, 0.27676845 ),
            vec2( 0.97484398, 0.75648379 ),
            vec2( 0.44323325, -0.97511554 ),
            vec2( 0.53742981, -0.47373420 ),
            vec2( -0.26496911, -0.41893023 ),
            vec2( 0.79197514, 0.19090188 ),
            vec2( -0.24188840, 0.99706507 ),
            vec2( -0.81409955, 0.91437590 ),
            vec2( 0.19984126, 0.78641367 ),
            vec2( 0.14383161, -0.14100790 )
        );
        float visibility = 0.0;
        for (int i=0; i<16; i++){
            int index = int(16.0*random(floor(f_posTangentSpace.xyz*1000.0), i))%16;
            visibility += texture(u_texShadow, vec3(projCoords.xy + poissonDisk[index]/500.0, projCoords.z - bias));
        }
        return visibility / 16.0;
    }
`;

const boxFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightColor;
    
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;
    uniform sampler2D u_texNormal;

    uniform mediump sampler2DShadow u_texShadow;

    uniform samplerCube u_cubeMap;

    in vec3 f_posTangentSpace;
    in vec4 f_posLightSpace;
    in vec3 f_lightDir;
    in vec3 f_viewPos;
    in vec3 f_texCoord;

    out vec4 FragColor;

    float calculateShadow();

    void main() {

        // texture
        vec3 texDiffuse = texture(u_cubeMap, f_texCoord).rgb;
        vec3 texSpecular = texture(u_cubeMap, f_texCoord).rgb;
        vec3 texNormal = texture(u_cubeMap, f_texCoord).rgb;

        // ambient
        vec3 ambient = texDiffuse * u_ambient;

        // diffuse
        vec3 normal = normalize( // only apply the normal map at half strength
            mix(vec3(0., 0., 1.),
            texNormal * (255./128.) - 1.0,
            0.5));
        float diffuseIntensity = max(dot(normal, f_lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(f_viewPos - f_posTangentSpace);
        vec3 halfWay = normalize(f_lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // shadow
        float shadow = calculateShadow();

        // color
        FragColor = vec4(ambient + shadow * (diffuse + specular), 1.0);
    }

    // Returns a "random" number based on a vec3 and an int.
    float random(vec3 seed, int i){
        vec4 seed4 = vec4(seed,i);
        float dot_product = dot(seed4, vec4(12.9898,78.233,45.164,94.673));
        return fract(sin(dot_product) * 43758.5453);
    }

    float calculateShadow() {
        // Perspective divide.
        vec3 projCoords = f_posLightSpace.xyz / f_posLightSpace.w;

        // No shadow for fragments outside of the light's frustum.
        if(any(lessThan(projCoords, vec3(0))) || any(greaterThan(projCoords, vec3(1)))){
            return 1.0;
        }

        // Determine the bias based on the angle of the light hitting the texture
        float bias = max(0.05 * (1.0 - dot(vec3(0.0, 0.0, 1.0), f_lightDir)), 0.005);

        // Get the closest depth value from light's perspective.
        const vec2 poissonDisk[16] = vec2[](
            vec2( -0.94201624, -0.39906216 ),
            vec2( 0.94558609, -0.76890725 ),
            vec2( -0.094184101, -0.92938870 ),
            vec2( 0.34495938, 0.29387760 ),
            vec2( -0.91588581, 0.45771432 ),
            vec2( -0.81544232, -0.87912464 ),
            vec2( -0.38277543, 0.27676845 ),
            vec2( 0.97484398, 0.75648379 ),
            vec2( 0.44323325, -0.97511554 ),
            vec2( 0.53742981, -0.47373420 ),
            vec2( -0.26496911, -0.41893023 ),
            vec2( 0.79197514, 0.19090188 ),
            vec2( -0.24188840, 0.99706507 ),
            vec2( -0.81409955, 0.91437590 ),
            vec2( 0.19984126, 0.78641367 ),
            vec2( 0.14383161, -0.14100790 )
        );
        float visibility = 0.0;
        for (int i=0; i<16; i++){
            int index = int(16.0*random(floor(f_posTangentSpace.xyz*1000.0), i))%16;
            visibility += texture(u_texShadow, vec3(projCoords.xy + poissonDisk[index]/500.0, projCoords.z - bias));
        }
        return visibility / 16.0;
    }
`;

const boxVertexShader = `#version 300 es
    precision highp float;

    uniform mat3 u_invLightRotation;
    uniform mat4 u_lightXform;
    uniform mat4 u_lightProjection;
    uniform mat4 u_viewXform;
    uniform mat4 u_cameraProjection;
    uniform vec3 u_viewPos;
    uniform mat3 u_normalMatrix;
    uniform mat4 u_modelMatrix;
    
    in vec3 a_pos;
    in vec3 a_normal;
    in vec3 a_tangent;
    in vec2 a_texCoord;

    out vec3 f_posTangentSpace;
    out vec4 f_posLightSpace;
    out vec3 f_lightDir;
    out vec3 f_viewPos;
    out vec3 f_texCoord;

    void main() {
        vec3 normal = u_normalMatrix * a_normal;
        vec3 tangent = u_normalMatrix * a_tangent;
        vec3 bitangent = cross(normal, tangent);
        mat3 tbn = transpose(mat3(tangent, bitangent, normal));

        // Transform world space coords to light space
        vec4 worldSpace = u_modelMatrix * vec4(a_pos, 1.0);
        f_posLightSpace = u_lightProjection * u_lightXform * worldSpace;

        // Transform world space coords to tangent space
        f_posTangentSpace = tbn * vec3(worldSpace);
        f_viewPos = tbn * u_viewPos;
        f_lightDir = tbn * u_invLightRotation * vec3(.0, .0, -1.0);

        f_texCoord = a_pos;

        gl_Position = u_cameraProjection * u_viewXform * worldSpace;
    }
`;

// Skybox ----------------------------------------------------------------------

const skyVertexShader = `#version 300 es
    precision highp float;

    uniform mat3 u_lightRotation;
    uniform mat3 u_viewRotation;
    uniform mat4 u_cameraProjection;

    in vec3 a_pos;

    out vec3 f_texCoord;

    // This matrix rotates the skybox so that the sun shines down the positive
    // Z axis instead of its native (unaligned) direction.
    const mat3 baseRotation = mat3(
        -0.9497352095434962, -0.0835014389652365, 0.30171268028391895,
        0.0, 0.9637708963658905, 0.26673143668883115,
        -0.3130543591029702, 0.2533242369155048, -0.9153271542119822
    );

    void main() {
        // Use the local position of the vertex as texture coordinate.
        f_texCoord = baseRotation * u_lightRotation * a_pos;

        // By setting Z == W, we ensure that the vertex is projected onto the
        // far plane, which is exactly what we want for the background.
        vec4 ndcPos = u_cameraProjection * inverse(mat4(u_viewRotation)) * vec4(a_pos, 1.0);
        gl_Position = ndcPos.xyww;
    }
`;

const skyFragmentShader = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 FragColor;

    void main() {
        FragColor = texture(u_skybox, f_texCoord);
    }
`;

// Debug Quad ------------------------------------------------------------------

const quadVertexShader = `#version 300 es
    precision highp float;

    in vec2 a_pos;
    in vec2 a_texCoord;

    out vec2 f_texCoord;

    void main()
    {
        f_texCoord = a_texCoord;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;

const quadFragmentShader = `#version 300 es
    precision mediump float;

    uniform sampler2D u_texture;

    in vec2 f_texCoord;

    out vec4 FragColor;

    void main() {
        float depth = texture(u_texture, f_texCoord).r;
        FragColor = vec4(vec3(depth), 1.0);
    }
`;


const postVertexShader = `#version 300 es
    precision highp float;

    in vec2 a_pos;
    in vec2 a_texCoord;

    out vec2 f_texCoord;

    void main()
    {
        f_texCoord = a_texCoord;
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;

const postFragmentShader2 = `#version 300 es
    precision mediump float;

    uniform sampler2D u_texture;
    uniform float u_time;

    in vec2 f_texCoord;

    out vec4 FragColor;

    vec3 greyscale(vec3 color)
    {
        return vec3(0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b);
    }

    vec3 applyKernel(sampler2D image, vec2 uv, float kernel[9], float offset)
    {
        const vec2 offsets[9] = vec2[](
            vec2(-1,  1), // top-left
            vec2( 0,  1), // top-center
            vec2( 1,  1), // top-right
            vec2(-1,  0), // center-left
            vec2( 0,  0), // center-center
            vec2( 1,  0), // center-right
            vec2(-1, -1), // bottom-left
            vec2( 0, -1), // bottom-center
            vec2( 1, -1)  // bottom-right
        );

        vec3 color = vec3(0.0);
        for(int i = 0; i < 9; i++) {
            color += texture(image, uv + offsets[i] * offset).rgb * kernel[i];
        }
        return color;
    }

    const float sharpenKernel[9] = float[](
        -1., -1., -1.,
        -1.,  9., -1.,
        -1., -1., -1.
    );

    const float blurKernel[9] = float[](
        1./ 16., 2./16., 1./16.,
        2./ 16., 4./16., 2./16.,
        1./ 16., 2./16., 1./16.
    );

    const float grainStrength = 65.0;

    const float bloomIntensity = 13.0;

    void main() {
        vec2 uv = gl_FragCoord.xy / vec2(512.0, 512.0);
        float x = (uv.x + 4.0 ) * (uv.y + 4.0 ) * (mod(u_time, 10000.));
        float grain = 1.0 - ((mod((mod(x, 13.0) + 1.0) * (mod(x, 123.0) + 1.0), 0.01)-0.005) * grainStrength);

        vec3 color = texture(u_texture, f_texCoord).rgb;
        vec3 blurred = applyKernel(u_texture, f_texCoord, blurKernel, 1.0 / 400.0);
        vec3 sharpened = applyKernel(u_texture, f_texCoord, sharpenKernel, 1.0 / 400.0);

        //color = mix(color, sharpened, 1.0);
        //color = mix(color, blurred, .7);
      
        // Adjust bloom effect
        vec3 bloom = bloomIntensity * (color - blurred);

        // Combine the original color, bloom, and grain
        color = color + bloom;

        FragColor = vec4(color, 1.0);
    }
`;



const postFragmentShader3 = `#version 300 es
    precision highp float;

    in vec2 f_texCoord;

    out vec4 fragColor;

    uniform sampler2D u_texture; // The input scene texture

    vec3 shades[4] = vec3[4](
        vec3(15./255., 56./255., 15./255.),
        vec3(48./255., 98./255., 48./255.),
        vec3(139./255., 172./255., 15./255.),
        vec3(155./255., 188./255., 15./255.)
    );
    
    void main() {
        vec2 uv = f_texCoord.xy;
        const float resolution = 160.;
        uv = floor(uv * resolution) / resolution;
        
        vec3 color = texture(u_texture, uv).rgb;
        
        float intensity = (color.r + color.g + color.b) / 4.;
        int index = int(intensity * 6.);
        
        fragColor = vec4(shades[index], 1.0);
    }
`;


const postFragmentShader = `#version 300 es
precision highp float;

in vec2 f_texCoord;
out vec4 fragColor;


uniform bool toggle_checked;
uniform sampler2D u_texture; // The input scene texture
uniform float u_time;
float val = 0.0;

void main()
{
    float eps = 0.0;
    if(toggle_checked)
        eps = -0.009*sin(u_time*0.005);
	vec2 uv = f_texCoord.xy;
	vec3 col;
    col.r = texture(u_texture, vec2(uv.x , uv.y - eps)).r;
	col.g = texture(u_texture, vec2(uv.x,       uv.y)).g;
	col.b = texture(u_texture, vec2(uv.x ,uv.y +eps)).b;
	
	fragColor = vec4(col, 1.0);
} 
`





// Shadow ----------------------------------------------------------------------

const shadowVertexShader = `#version 300 es
precision highp float;

 in vec3 a_pos;

uniform mat4 u_modelMatrix;
uniform mat4 u_lightXform;
uniform mat4 u_lightProjection;

void main()
{
    gl_Position = u_lightProjection * u_lightXform * u_modelMatrix * vec4(a_pos, 1.0);
}
`;


const shadowFragmentShader = `#version 300 es
    precision mediump float;

    void main() {}
`;

// =============================================================================
// Geometry
// =============================================================================

const cameraProjection = mat4.perspective(Math.PI / 4, 1, 0.1, 14);

const lightProjection = mat4.ortho(-1.43, 1.43, -0.55, 0.77, -0.3, 2.2);
const textureLightProjection = mat4.multiply(
    mat4.multiply(
        mat4.fromTranslation([0.5, 0.5, 0.5]),
        mat4.fromScaling([0.5, 0.5, 0.5]),
    ),
    lightProjection,
);

const solidShader = glance.buildShaderProgram(gl, "floor-shader", solidVertexShader, solidFragmentShader, {
    u_ambient: 1.0,
    u_specular: 0.35,
    u_shininess: 64,
    u_lightColor: [1, 1, 1],
    u_cameraProjection: cameraProjection,
    u_lightProjection: textureLightProjection,
    u_texDiffuse: 0,
    u_texSpecular: 1,
    u_texNormal: 2,
    u_texShadow: 3,
});

// Floor -----------------------------------------------------------------------


const { attributes: platAttr, indices: platIdx } = await glance.loadObj("obj/platformGoal.obj", { normals: true, tangents: true });


const floorIBO = glance.createIndexBuffer(gl, platIdx);

const floorABO = glance.createAttributeBuffer(gl, "floor-abo", platAttr, {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_tangent: { size: 3, type: gl.FLOAT },
});



//const floorModelMatrix = mat4.fromRotation(Math.PI / 2, [-1, 0, 0]);
const floorModelMatrix = mat4.fromRotation(Math.PI, [0, 1, 0]);
const floorNormalMatrix = mat3.fromMat4(floorModelMatrix);
const floorInstanceAttributes = new Float32Array([...floorModelMatrix, ...floorNormalMatrix]);
/*const floorIABO = glance.createAttributeBuffer(gl, "floor-iabo", floorInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});*/

const floorVAO = glance.createVAO(
    gl,
    "floor-vao",
    floorIBO,
    glance.buildAttributeMap(solidShader, floorABO, ["a_pos", "a_texCoord", "a_normal", "a_tangent"]),
);

const floorTextureDiffuse = await glance.loadTextureNow(gl, "./img/Rockwall_Diffuse.jpg");
const floorTextureSpecular = await glance.loadTextureNow(gl, "./img/Rockwall_Specular.jpg");
const floorTextureNormal = await glance.loadTextureNow(gl, "./img/rock_wall_normal.jpg");

// Box -----------------------------------------------------------------------

const boxIBO = glance.createIndexBuffer(gl, glance.createBoxIndices());
const boxSize = 0.4;
const boxABO = glance.createAttributeBuffer(gl, "box-abo", glance.createBoxAttributes(boxSize, { tangents: true }), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_tangent: { size: 3, type: gl.FLOAT },
});

const boxModelMatrix = mat4.fromTranslation([0, 0.2, 0]);
const boxNormalMatrix = mat3.fromMat4(boxModelMatrix);
const boxInstanceAttributes = new Float32Array([...boxModelMatrix, ...boxNormalMatrix]);
/*const boxIABO = glance.createAttributeBuffer(gl, "box-iabo", boxInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});*/


const boxShader = glance.buildShaderProgram(gl, "box-shader", boxVertexShader, boxFragmentShader, {
    u_ambient: 0.7,
    u_specular: 0.35,
    u_shininess: 64,
    u_lightColor: [1, 1, 1],
    u_cameraProjection: cameraProjection,
    u_lightProjection: textureLightProjection,
    u_cubeMap: 0,
    u_texShadow: 1,
});


const boxCubemap = await glance.loadCubemapNow(gl, "box-texture", [
    "img/box_texture.avif",
    "img/box_texture.avif",
    "img/box_texture.avif",
    "img/box_texture.avif",
    "img/box_texture.avif",
    "img/box_under_side.avif",
]);


const boxVAO = glance.createVAO(
    gl,
    "box-vao",
    boxIBO,
    glance.buildAttributeMap(boxShader, boxABO, ["a_pos", "a_normal", "a_tangent"])
);

// Skybox ----------------------------------------------------------------------

const skyShader = glance.buildShaderProgram(gl, "sky-shader", skyVertexShader, skyFragmentShader, {
    u_cameraProjection: cameraProjection,
    u_skybox: 0,
});

const boxIndex = glance.createBoxIndices(true);
const boxAttributes = glance.createBoxAttributes(2, { normals: false, texCoords: false, sharedVertices: true });
const skyIBO = glance.createIndexBuffer(gl, boxIndex);
const skyABO = glance.createAttributeBuffer(gl, "sky-abo", boxAttributes, {
    a_pos: { size: 3, type: gl.FLOAT },
});







const skyVAO = glance.createVAO(gl, "sky-vao", skyIBO, glance.buildAttributeMap(skyShader, skyABO));

const skyCubemap = await glance.loadCubemapNow(gl, "sky-texture", [
    "img/himmel_rechts.jpg",
    "img/himmel_links.jpg",
    "img/himmel_oben.jpg",
    "img/himmel_unten.jpg",
    "img/himmel_vorne.jpg",
    "img/himmel_hinten.jpg",
]);

// Debug Quad ------------------------------------------------------------------

const quadShader = glance.buildShaderProgram(gl, "quad-shader", quadVertexShader, quadFragmentShader, {
    u_texture: 0,
});

const quadIBO = glance.createIndexBuffer(gl, glance.createQuadIndices());

const quadABO = glance.createAttributeBuffer(gl, "quad-abo", glance.createQuadAttributes(), {
    a_pos: { size: 2, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
});

const quadVAO = glance.createVAO(gl, "quad-vao", quadIBO, glance.buildAttributeMap(quadShader, quadABO));

// =============================================================================
// Shadow Setup
// =============================================================================

const shadowShader = glance.buildShaderProgram(gl, "shadow-shader", shadowVertexShader, shadowFragmentShader, {
    u_lightProjection: lightProjection,
});

const shadowDepthTexture = glance.createTexture(gl, "shadow-depth", 1024, 1024, gl.TEXTURE_2D, null, {
    useAnisotropy: false,
    // internalFormat: gl.DEPTH_COMPONENT16,
    internalFormat: gl.DEPTH_COMPONENT24,
    // internalFormat: gl.DEPTH_COMPONENT32F,
    // levels: 1,
    filter: gl.LINEAR,
    compareFunc: gl.LEQUAL,
});

const shadowFramebuffer = glance.createFramebuffer(gl, "shadow-framebuffer", null, shadowDepthTexture);





//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!Post FX !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!//
const postShader = glance.buildShaderProgram(gl, "post-shader", postVertexShader, postFragmentShader, {
    u_texture: 0,
});

const postIBO = glance.createIndexBuffer(gl, glance.createQuadIndices());

const postABO = glance.createAttributeBuffer(gl, "post-abo", glance.createQuadAttributes(), {
    a_pos: { size: 2, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
});

const postVAO = glance.createVAO(gl, "post-vao", postIBO, glance.buildAttributeMap(postShader, postABO));

// =============================================================================
// Framebuffer
// =============================================================================

const postColor = glance.createTexture(gl, "color-target", 512, 512, gl.TEXTURE_2D, null, {
    useAnisotropy: false,
    internalFormat: gl.RGBA8,
    levels: 1,
});

const postDepth = glance.createRenderbuffer(gl, "depth-target", 512, 512, gl.DEPTH_COMPONENT16);

const postFramebuffer = glance.createFramebuffer(gl, "framebuffer", postColor, postDepth);



// =============================================================================
// Draw Calls
// =============================================================================

// Scene State
let viewDist = 7.3;
let viewPan = -3.14;
let viewTilt = -0.4;
let panDelta = 0;
let tiltDelta = 0;

const viewRotation = new glance.Cached(
    () =>
        mat4.multiply(
            mat4.fromRotation(viewPan, [0, 1, 0]),
            mat4.fromRotation(viewTilt, [1, 0, 0]),
        )
);

const viewXform = new glance.Cached(
    () => mat4.multiply(
        viewRotation.get(),
        mat4.fromTranslation([0, 0, viewDist]),
    ),
    [viewRotation]
);

const invViewXform = new glance.Cached(
    () => mat4.invert(viewXform.get()),
    [viewXform]
);

const rotationSpeed = 0.00003;
const lightTilt = 0.4;
const lightRotation = new glance.TimeSensitive(
    (time) => mat3.fromMat4(mat4.multiply(
        mat4.fromRotation(-lightTilt, [1, 0, 0]),
        mat4.fromRotation(0.9, [0, 1, 0]),
    )),
);
const invLightRotation = new glance.TimeSensitive(
    (time) => mat3.transpose(lightRotation.getAt(time)),
);
const lightXform = new glance.TimeSensitive(
    (time) => mat4.lookAt(
        vec3.transformMat3([0, 0, -1], invLightRotation.getAt(time)),
        [0, 0, 0],
        [0, 1, 0]
    )
);

// Beauty ----------------------------------------------------------------------

const floorDrawCall = glance.createDrawCall(
    gl,
    solidShader,
    floorVAO,
    {
        uniforms: {
            u_lightXform: (time) => lightXform.getAt(time),
            u_invLightRotation: (time) => invLightRotation.getAt(time),
            u_viewXform: () => invViewXform.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewXform.get()),
        },
        textures: [
            [0, floorTextureDiffuse],
            [1, floorTextureSpecular],
            [2, floorTextureNormal],
            [3, shadowDepthTexture],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const boxDrawCall = glance.createDrawCall(
    gl,
    boxShader,
    boxVAO,
    {
        uniforms: {
            u_modelMatrix: () => cubeXform,
            u_normalMatrix: () => mat3.fromMat4(cubeXform),
            u_lightXform: (time) => lightXform.getAt(time),
            u_invLightRotation: (time) => invLightRotation.getAt(time),
            u_viewXform: () => invViewXform.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewXform.get()),
        },
        textures: [
            [0, boxCubemap],
            [1, shadowDepthTexture],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const skyDrawCall = glance.createDrawCall(
    gl,
    skyShader,
    skyVAO,
    {
        uniforms: {
            u_lightRotation: () => mat3.identity(),
            u_viewRotation: () => mat3.fromMat4(viewRotation.get()),
        },
        textures: [
            [0, skyCubemap],
        ],
        cullFace: gl.NONE,
        depthTest: gl.LEQUAL,
    }
);

const quadDrawCall = glance.createDrawCall(
    gl,
    quadShader,
    quadVAO,
    {
        textures: [
            [0, shadowDepthTexture],
        ],
        cullFace: gl.NONE,
        depthTest: gl.NONE,
    }
);

// Shadow ----------------------------------------------------------------------

const shadowDrawCalls = [
    glance.createDrawCall(
        gl,
        shadowShader,
        boxVAO,
        {
            uniforms: {
                u_lightXform: (time) => lightXform.getAt(time),
                u_modelMatrix: () => cubeXform,
            },
            cullFace: gl.BACK, // FRONT,
            depthTest: gl.LESS,
        }
    ),
    glance.createDrawCall(
        gl,
        shadowShader,
        floorVAO,
        {
            uniforms: {
                u_lightXform: (time) => lightXform.getAt(time),
                u_modelMatrix: () => floorModelMatrix,
            },
            cullFace: gl.BACK, // FRONT,
            depthTest: gl.LESS,
        }
    ),
];


// ------------------------------------------------ Post Draw Call
const postDrawCall = glance.createDrawCall(
    gl,
    postShader,
    postVAO,
    {
        uniforms: {
            u_time: (time) => time,
            toggle_checked: () => effektOn,
        },
        textures: [
            [0, postColor],
        ],
        cullFace: gl.NONE,
        depthTest: gl.NONE,
    }
);

let winpos = [-0.8,0,2]

let effektOn = false;
// =============================================================================
// System Integration
// =============================================================================

// Store the Cube State in 2 variables, this will make it easier to animate them
// individually.
let cubePosition = [0, 0, 0];
let cubeOrientation = mat4.identity();
// The complete transformation matrix of the cube is then calculated by combining
// the rotation and translation.
let cubeXform = mat4.identity();

let stepProgress = null;
let stepDirection = null;

let won = false;


let mapPositions =[
    [0,0,0],
    [0,0,0.4],
    [0,0,0.8],
    [0,0,1.2],
    [-0.4,0,1.2],
    [-0.8,0,1.2],
    [-0.8,0,2],
    [-0.4,0,0.4],
    [-0.8,0,0.4],
    [-0.8,0,0.8],
    [-1.2,0,0.8],
    [-0.8,0,1.2],
    [-0.8,0,1.6]
]

function updateCubeState(deltaTime) {
    // If there is no animation happening, there is nothing to update.
    
    
    
    if (stepProgress === null) {
        return;
    }

    if(won){
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
        let roundedPosition = cubePosition.map(value => parseFloat(value.toFixed(2)));
        let arraysAreEqual = roundedPosition.every((value, index) => value === winpos[index]);
        if(arraysAreEqual){
            console.log("you win");
            won = true;
            const winMessage = document.getElementById('win-message');
            winMessage.classList.add('show');
        }else{
            let isMatchingPosition = false;

            // Loop through each position in mapPositions
            for (let i = 0; i < mapPositions.length; i++) {
                const position = mapPositions[i];

                // Check if the rounded position matches the current position
                if (position.every((value, index) => value === roundedPosition[index])) {
                    isMatchingPosition = true;
                    break; // Break out of the loop since a match is found
                }
            }

            // If not matching, reload the page
            if (!isMatchingPosition) {
                effektOn = true;
                setTimeout(() => {
                    location.reload();
                },3000)
            }
        }
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






onMouseDrag((e) => {
    viewPan += e.movementX * -.01;
    viewTilt += e.movementY * -.01;
    viewRotation.setDirty();
});

onMouseWheel((e) => {
    viewDist = Math.max(1.5, Math.min(5, viewDist * (1 + Math.sign(e.deltaY) * 0.2)));
    viewXform.setDirty();
});

onKeyDown((e) => {

   

    if (e.key == "ArrowLeft") {
        panDelta = Math.max(panDelta - 1, -1);
    }
    if (e.key == "ArrowRight") {
        panDelta = Math.min(panDelta + 1, 1);
    }
    if (e.key == "ArrowUp") {
        tiltDelta = Math.max(tiltDelta - 1, -1);
    }
    if (e.key == "ArrowDown") {
        tiltDelta = Math.min(tiltDelta + 1, 1);
    }

    // Ignore the key if the box is already moving.
    if (stepProgress !== null) {
        return;
    }

    // Set the move direction based on the key.
    switch (e.key) {
        case "a":
            stepDirection = [1, 0, 0];
            break;
        case "d":
            stepDirection = [-1, 0, 0];
            break;
        case "s":
            stepDirection = [0, 0, -1];
            break;
        case "w":
            stepDirection = [0, 0, 1];
            break;
        default:
            return;
    }

    // Start the animation, if one of the four movement keys was pressed.
    stepProgress = 0;

    console.log(cubePosition);

});

onKeyUp((e) => {
    if (e.key == "ArrowLeft") {
        panDelta = Math.min(panDelta + 1, 1);
    }
    if (e.key == "ArrowRight") {
        panDelta = Math.max(panDelta - 1, -1);
    }
    if (e.key == "ArrowUp") {
        tiltDelta = Math.min(tiltDelta + 1, 1);
    }
    if (e.key == "ArrowDown") {
        tiltDelta = Math.max(tiltDelta - 1, -1);
    }
});

const framebufferStack = new glance.FramebufferStack();

let lastTime = 0;
setRenderLoop((time) => {

    const deltaTime = time - lastTime;
    lastTime = time;

    updateCubeState(deltaTime);


    if (panDelta != 0 || tiltDelta != 0) {
        viewPan += panDelta * .02;
        viewTilt += tiltDelta * .02;
        viewRotation.setDirty();
    }



    //Render PostFX
    framebufferStack.push(gl, postFramebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);



    // Render shadow map
    framebufferStack.push(gl, shadowFramebuffer);
    {
        gl.clear(gl.DEPTH_BUFFER_BIT);
        for (const drawCall of shadowDrawCalls) {
            glance.performDrawCall(gl, drawCall, time);
        }
    }

    framebufferStack.pop(gl);
    //framebufferStack.pop(gl);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (0) {
        glance.performDrawCall(gl, postDrawCall, time);
    } else {


        glance.performDrawCall(gl, boxDrawCall, time);
        glance.performDrawCall(gl, floorDrawCall, time);
        glance.performDrawCall(gl, skyDrawCall, time);

    }
    framebufferStack.pop(gl);
    glance.performDrawCall(gl, postDrawCall, time);

});