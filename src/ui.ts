
import './main.css';
import './ui.css';

import JSZip from '../node_modules/jszip/dist/jszip.js'; 
import images from './images.json';

window.onmessage = async (event) => {
    const pluginMessage = event.data.pluginMessage;

    if (!pluginMessage) {
        return;
    }

    if (pluginMessage && pluginMessage.type === 'show-message') {
        const message = pluginMessage.text;
        const text = document.createElement('p');
        text.className = 'type type--12-pos-medium message';
        text.textContent = message;
        document.getElementById('content').appendChild(text);
    }

    // Export PNG
    if (pluginMessage && pluginMessage.type === 'export-png') {
        const name: string = pluginMessage.exportImages.length > 1 ? 'assets' : pluginMessage.exportImages[0][0].path.match(/.*\/(.*)\.png/)[1];
        const assets = await getPNGAssetsFromPluginMessage(pluginMessage);
        const message: string = 'Click "Save" button to export ' + pluginMessage.exportImages.length + ' PNG asset'
            + (pluginMessage.exportImages.length > 1 ? 's' : '')
            + '.';
        downloadZip(assets, name, message);
    }

    // Export nine-patch
    if (pluginMessage && pluginMessage.type === 'export-nine-patch') {
        const name: string = pluginMessage.exportImages.length > 1 ? 'assets' : pluginMessage.exportImages[0].name.replace(/\.png$/);
        const assets = await getNinePatchAssetsFromPluginMessage(pluginMessage);
        const message: string = 'Click "Save" button to export ' + pluginMessage.exportImages.length + ' nine-patch asset'
            + (pluginMessage.exportImages.length > 1 ? 's' : '')
            + '.';
        downloadZip(assets, name, message);
    }

    if (pluginMessage === 'new-app-icon') {
        for (let key in images) {
            images[key] = base64ToUint8Array(images[key]);
        }
        window.parent.postMessage({pluginMessage: images}, '*')
    }

}

async function getPNGAssetsFromPluginMessage(pluginMessage: any): Promise<any []> {
    let assets: any [] = [];
    for (const exportImage of pluginMessage.exportImages) {
        for (const item of exportImage) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = item.width;
            canvas.height = item.height;
            const imageData = await figmaImageDataToHTMLImageData(item.imageData);
            ctx.putImageData(imageData, 0, 0);
            assets.push({
                path: item.path,
                blob: await canvasToBlob(canvas)
            });
        }
    }
    return assets;
}

async function figmaImageDataToHTMLImageData(data: Uint8Array): Promise<ImageData> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const url = URL.createObjectURL(new Blob([data]));
    const image: HTMLImageElement = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject();
        img.src = url;
    });
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob: Blob) => {
            resolve(blob);
        }, 'image/png', 1);
    })
}

// @returns Array [{path: string, blob: Blob}]
function downloadZip(assets: any [], name: string, message: string): Promise<null> {
    return new Promise((resolve, reject) => {
        let zip = new JSZip();
        for (let file of assets) {
            zip.file(file.path, file.blob, {binary: true});
        }
        zip.generateAsync({type: 'blob'})
        .then((content: Blob) => {

            // Use auto-download will make Figma crash.

            // const blobURL = window.URL.createObjectURL(content);
            // const link = document.createElement('a');
            // link.href = blobURL;
            // link.style.display = 'none';
            // link.setAttribute('download', name + '.zip');
            // if (typeof link.download === 'undefined') {
            //     link.setAttribute('target', '_blank');
            // }
            // document.body.appendChild(link);
            // link.click();
            // document.body.removeChild(link);
            // window.URL.revokeObjectURL(blobURL);

            const text = document.createElement('p');
            text.className = 'type type--12-pos-medium message';
            text.textContent = message;
            document.getElementById('content').appendChild(text);

            const blobURL = window.URL.createObjectURL(content);
            const link = document.createElement('a');
            link.className = 'button button--primary';
            link.href = blobURL;
            link.text = 'Save';
            link.setAttribute('download', name + '.zip');
            document.getElementById('footer').appendChild(link);

            resolve();
        });
    });
}

// @returns Array [{path: string, blob: Blob}]
async function getNinePatchAssetsFromPluginMessage(pluginMessage: any): Promise<any []> {
    let assets: any [] = [];
    for (const ninePatchImage of pluginMessage.exportImages) {
        const contentImages = ninePatchImage.contentImages;
        for (const contentImage of contentImages) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = contentImage.width + 2;
            canvas.height = contentImage.height + 2;
            const patchData = await figmaImageDataToHTMLImageData(ninePatchImage.patchImage.imageData);
            const contentData = await figmaImageDataToHTMLImageData(contentImage.imageData);
            // Top
            const topPatchData = patchLineFromImageData(patchData, 'top', contentImage.scale);
            ctx.putImageData(topPatchData, 1, 0);
            // Right
            const rightPatchData = patchLineFromImageData(patchData, 'right', contentImage.scale);
            ctx.putImageData(rightPatchData, contentImage.width + 1, 1);
            // Bottom
            const bottomPatchData = patchLineFromImageData(patchData, 'bottom', contentImage.scale);
            ctx.putImageData(bottomPatchData, 1, contentImage.height + 1);
            // Left
            const leftPatchData = patchLineFromImageData(patchData, 'left', contentImage.scale);
            ctx.putImageData(leftPatchData, 0, 1);
            // Content
            ctx.putImageData(contentData, 1, 1);
            assets.push({
                path: contentImage.path,
                blob: await canvasToBlob(canvas)
            });
        }
    }
    return assets;
}

// @param  side: top | right | bottom | left
function patchLineFromImageData(data: ImageData, side: string, scale: number): ImageData {
    let originalPatchLineData;
    let originalWidth;
    let originalHeight;
    let width = 1;
    let height = 1;
    if (side === 'top') {
        originalWidth = data.width - 2;
        originalHeight = 1;
        width = Math.floor(originalWidth * scale);
        originalPatchLineData = data.data.slice(4, originalWidth * 4 + 4);
    }
    if (side === 'right') {
        originalWidth = 1;
        originalHeight = data.height - 2;
        height = Math.floor(originalHeight * scale);
        originalPatchLineData = data.data.filter((item, index) => {
            return index % ((data.width) * 4) == data.width * 4 - 4 ||
                index % ((data.width) * 4) == data.width * 4 - 3 ||
                index % ((data.width) * 4) == data.width * 4 - 2 ||
                index % ((data.width) * 4) == data.width * 4 - 1;
        });
        originalPatchLineData = originalPatchLineData.slice(4, originalHeight * 4 + 4);
    }
    if (side === 'bottom') {
        originalWidth = data.width - 2;
        originalHeight = 1;
        width = Math.floor(originalWidth * scale);
        originalPatchLineData = data.data.slice(data.width * (data.height - 1) * 4 + 4, originalWidth * 4 + data.width * (data.height - 1) * 4 + 4);
    }
    if (side === 'left') {
        originalWidth = 1;
        originalHeight = data.height - 2;
        height = Math.floor(originalHeight * scale);
        originalPatchLineData = data.data.filter((item, index) => {
            return index % ((data.width) * 4) == 0 ||
                index % ((data.width) * 4) == 1 ||
                index % ((data.width) * 4) == 2 ||
                index % ((data.width) * 4) == 3;
        });
        originalPatchLineData = originalPatchLineData.slice(4, originalHeight * 4 + 4);
    }
    // Nearest Neighbor Scale
    let scaledPatchLineData = new Uint8ClampedArray(width * height * 4);
    let pos = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcX = Math.floor(x / scale);
            const srcY = Math.floor(y / scale);
            let srcPos = ((srcY * originalWidth) + srcX) * 4;
            scaledPatchLineData[pos++] = originalPatchLineData[srcPos++];
            scaledPatchLineData[pos++] = originalPatchLineData[srcPos++];
            scaledPatchLineData[pos++] = originalPatchLineData[srcPos++];
            scaledPatchLineData[pos++] = originalPatchLineData[srcPos++];
        }
    }
    const imageData = new ImageData(scaledPatchLineData, width, height);
    return imageData;
}

function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}