import './ui.css';

import JSZip from '../node_modules/jszip'; 
import images from './images.json';

window.onmessage = async (event) => {
    const pluginMessage = event.data.pluginMessage;

    if (!pluginMessage) {
        return;
    }

    if (pluginMessage.type === 'show-message') {
        const message = pluginMessage.text;
        const tip = document.createElement('div');
        tip.className = 'onboarding-tip';
        const tipIcon = document.createElement('div');
        tipIcon.className = 'onboarding-tip__icon';
        const icon = document.createElement('div');
        icon.className = 'icon icon--plugin';
        const text = document.createElement('div'); 
        text.className = 'onboarding-tip__msg';
        text.textContent = message;
        tipIcon.appendChild(icon);
        tip.appendChild(tipIcon);
        tip.appendChild(text);
        const contentDiv = document.getElementById('content');
        const appDiv = document.getElementById('app');
        contentDiv.appendChild(tip);
        appDiv.className += ' session__message';
    }

    // Export PNG
    if (pluginMessage.type === 'export-png') {
        const name: string = pluginMessage.exportImages.length > 1 ? 'assets' : pluginMessage.exportImages[0][0].path.match(/.*\/(.*)\.png/)[1];
        const assets = await getPNGAssetsFromPluginMessage(pluginMessage);
        createAssetsPreview(assets);
        showDownloadButton(assets, name);
    }

    // Export nine-patch
    if (pluginMessage.type === 'export-nine-patch') {
        const name: string = pluginMessage.exportImages.length > 1 ? 'assets' : pluginMessage.exportImages[0].name.replace(/\.png$/);
        const assets = await getNinePatchAssetsFromPluginMessage(pluginMessage);
        createAssetsPreview(assets);
        showDownloadButton(assets, name);
    }

    // New app icon
    if (pluginMessage === 'new-app-icon') {
        for (let key in images) {
            images[key] = base64ToUint8Array(images[key]);
        }
        window.parent.postMessage({pluginMessage: images}, '*')
    }

    // Export app icon
    if (pluginMessage.type === 'export-app-icon') {
        const assets = await getPNGAssetsFromPluginMessage(pluginMessage);

        // Adaptive icon XML 
        const xml = '<?xml version="1.0" encoding="utf-8"?>\n' +
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
            '    <background android:drawable="@mipmap/ic_launcher_background" />\n' +
            '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n' +
            '</adaptive-icon>'
        assets.push({
            path: 'mipmap-v26/ic_launcher.xml',
            text: xml
        });
        
        // Icon preview
        const oldIcon = assets.find(item => item.path === 'mipmap-xxxhdpi/ic_launcher.png');
        const adaptiveIconBackground = assets.find(item => item.path === 'mipmap-xxxhdpi/ic_background.png');
        const adaptiveIconForeground = assets.find(item => item.path === 'mipmap-xxxhdpi/ic_foreground.png');
        const playStoreIcon = assets.find(item => item.path === 'playstore_icon.png');
        const contentDiv = document.getElementById('content');

        const item1 = document.createElement('div');
        item1.className = 'thumb';
        const img1 = document.createElement('div');
        img1.className = 'thumb__img thumb__img--old-app-icon';
        img1.style.backgroundImage = 'url("' + oldIcon.base64 + '")';
        const text1 = document.createElement('div');
        text1.className = 'type type--11-pos thumb__txt';
        text1.textContent = 'Normal Icon';
        item1.appendChild(img1);
        item1.appendChild(text1);
        contentDiv.appendChild(item1);

        const item2 = document.createElement('div');
        item2.className = 'thumb';
        const img2 = document.createElement('div');
        img2.className = 'thumb__img thumb__img--app-icon-adaptive';
        img2.style.backgroundImage = 'url("' + adaptiveIconForeground.base64 + '"),url("' + adaptiveIconBackground.base64 + '")';
        const text2 = document.createElement('div');
        text2.className = 'type type--11-pos thumb__txt';
        text2.textContent = 'Adaptive Icon';
        item2.appendChild(img2);
        item2.appendChild(text2);
        contentDiv.appendChild(item2);

        if (playStoreIcon) {
            const item3 = document.createElement('div');
            item3.className = 'thumb';
            const img3 = document.createElement('div');
            img3.className = 'thumb__img thumb__img--app-icon-playstore';
            img3.style.backgroundImage = 'url("' + playStoreIcon.base64 + '")';
            const text3 = document.createElement('div');
            text3.className = 'type type--11-pos thumb__txt';
            text3.innerText = 'Play Store Icon';
            item3.appendChild(img3);
            item3.appendChild(text3);
            contentDiv.appendChild(item3);
        }

        // Download button
        showDownloadButton(assets, 'launcher_icon');
    }
}

function createAssetsPreview(assets: any []) {
    const contentDiv = document.getElementById('content');
    assets.forEach(item => {
        if (/^drawable-xxxhdpi/.test(item.path)) {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'thumb';
            const image = document.createElement('div');
            image.className = 'thumb__img';
            image.style.backgroundImage = 'url("' + item.base64 + '")';
            const text = document.createElement('div');
            text.className = 'type type--11-pos thumb__txt';
            const name = item.path.replace(/^drawable-xxxhdpi\//, '').replace(/\.png$/, '');
            text.textContent = name;
            itemDiv.appendChild(image);
            itemDiv.appendChild(text);
            contentDiv.appendChild(itemDiv);
        }
    });
}

async function getPNGAssetsFromPluginMessage(pluginMessage: any): Promise<any []> {
    let assets: any [] = [];
    for (const exportImage of pluginMessage.exportImages) {
        for (const item of exportImage) {
            const canvas = await figmaImageDataToCanvas(item.imageData);
            assets.push({
                path: item.path,
                base64: canvasToBase64(canvas)
            });
        }
    }
    return assets;
}

async function figmaImageDataToCanvas(data: Uint8Array): Promise<HTMLCanvasElement> {
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
    return canvas;
}

function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext('2d');
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
    return canvas.toDataURL('image/png');
}

/**
 * @param  {any[]} assets [{path: string, blob: Blob, text: string}]
 * @param  {string} name
 * @returns Promise
 */
function showDownloadButton(assets: any [], name: string): Promise<null> {
    return new Promise((resolve, reject) => {
        let zip = new JSZip();
        for (let file of assets) {
            if (file.blob) {
                zip.file(file.path, file.blob, {binary: true});
            } else if (file.base64) {
                zip.file(file.path, file.base64.replace('data:image/png;base64,', ''), {base64: true});
            } else if (file.text) {
                zip.file(file.path, file.text);
            }
        }
        zip.generateAsync({type: 'blob'})
        .then((content: Blob) => {
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
            const patchCanvas = await figmaImageDataToCanvas(ninePatchImage.patchImage.imageData);
            const contentCanvas = await figmaImageDataToCanvas(contentImage.imageData);
            const patchData = canvasToImageData(patchCanvas);
            const contentData = canvasToImageData(contentCanvas);
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
                base64: canvasToBase64(canvas)
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