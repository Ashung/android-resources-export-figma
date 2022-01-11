import './ui.css';
import guideImages from './images.json';
import JSZip from 'jszip';

window.onmessage = async (event) => {
    const pluginMessage = event.data.pluginMessage;

    if (!pluginMessage) {
        return;
    }

    // Export PNG
    if (pluginMessage.type === 'export-png') {
        const assets = await getPNGAssetsFromPluginMessage(pluginMessage);
        createAssetsPreview(assets);
    }

    // Export nine-patch
    if (pluginMessage.type === 'export-nine-patch') {
        const assets = await getNinePatchAssetsFromPluginMessage(pluginMessage);
        createAssetsPreview(assets);
    }

    // New app icon
    if (pluginMessage === 'new-app-icon') {
        for (let key in guideImages) {
            guideImages[key] = base64ToUint8Array(guideImages[key]);
        }
        parent.postMessage({
            pluginMessage: {
                type: 'newAppIcon',
                images: guideImages
            }
        }, '*');
    }

    // Export app icon
    if (pluginMessage.type === 'export-app-icon') {
        const assets = await getPNGAssetsFromPluginMessage(pluginMessage);
        createAssetsPreview(assets, true);
    }

    // Setting
    if (pluginMessage.type === 'settings') {
        settings(pluginMessage.data);
    }
}

function settings(dpis: [any]) {
    const contentDiv = document.getElementById('content');
    const footerDiv = document.getElementById('footer');
    
    const label = document.createElement('label');
    label.className = 'setting-label type--11-pos';
    label.textContent = 'Export dpis:';
    contentDiv.appendChild(label);

    const checkboxs: HTMLInputElement[] = [];
    dpis.forEach((dpi, idx) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'export-item';
        itemDiv.style.margin = '0';
        contentDiv.appendChild(itemDiv);

        const checkboxWrap = document.createElement('label');
        checkboxWrap.className = 'export-item__checkbox';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        checkbox.id = 'dpi_' + idx;
        checkbox.dataset.scale = String(dpi.scale);
        checkbox.dataset.dpi = dpi.dpi;
        if (dpi.active === true) {
            checkbox.checked = true;
        }
        checkboxs.push(checkbox);
        checkboxWrap.appendChild(checkbox);
        itemDiv.appendChild(checkboxWrap);

        const textWrap = document.createElement('div');
        textWrap.className = 'type type--11-pos export-item__text';
        const text = document.createElement('label');
        text.textContent = dpi.dpi.toUpperCase() + ' (' + dpi.scale + 'x)';
        text.setAttribute('for', 'dpi_' + idx);
        textWrap.appendChild(text);
        itemDiv.appendChild(textWrap);

        checkbox.onclick = (event) => {
            const target = event.target as HTMLInputElement;
            const actives = checkboxs.map(item => item.checked);
            if (actives.every(item => item === false)) {
                target.checked = true;
            }
        };
    });

    const saveButton = document.createElement('button');
    saveButton.className = 'button button--primary';
    saveButton.textContent = 'Save';
    footerDiv.style.justifyContent = 'flex-end';
    footerDiv.appendChild(saveButton);

    // Save button
    saveButton.onclick = () => {
        const settings = checkboxs.map(checkbox => {
            return {
                scale: parseFloat(checkbox.dataset.scale),
                dpi: checkbox.dataset.dpi,
                active: checkbox.checked
            }
        });
        console.log(JSON.stringify(settings));
        parent.postMessage({
            pluginMessage: {
                type: 'saveSettings',
                data: settings
            }
        }, '*');
    };
}

function createAssetsPreview(assets: {id: string, path: string, data?: Uint8Array, base64?: string}[], exportIcon?: boolean) {
    const contentDiv = document.getElementById('content');
    const footerDiv = document.getElementById('footer');
    const assetsCount = Math.ceil(assets.length / 5);

    const selectAllCheckboxWrap = document.createElement('label');
    selectAllCheckboxWrap.className = 'selectAll__wrap';
    const selectAllCheckbox = document.createElement('input');
    selectAllCheckbox.type = 'checkbox';
    selectAllCheckbox.className = 'checkbox';
    selectAllCheckbox.id = 'selectAll';
    selectAllCheckbox.checked = true;
    if (!exportIcon) {
        selectAllCheckboxWrap.appendChild(selectAllCheckbox);
    }
    footerDiv.appendChild(selectAllCheckboxWrap);

    const selectAllLabel = document.createElement('div');
    selectAllLabel.className = 'type type--11-pos selectAll__label';
    const selectAllLabelText = document.createElement('label');
    selectAllLabelText.setAttribute('for', 'selectAll');
    selectAllLabelText.textContent = `${assetsCount} / ${assetsCount}`;
    if (!exportIcon) {
        selectAllLabel.appendChild(selectAllLabelText);
    }
    footerDiv.appendChild(selectAllLabel);

    const exportButton = document.createElement('button');
    exportButton.className = 'button button--primary';
    exportButton.textContent = 'Export';
    footerDiv.appendChild(exportButton);

    let selectedCount = assetsCount;
    const assetIds: string[] = [];
    const assetNames: string[] = [];
    assets.forEach(item => {
        if (!assetIds.includes(item.id)) {
            const assetName = item.path.replace(/^(drawable|mipmap)-(m|h|xh|xxh|xxxh)dpi\//, '');
            assetIds.push(item.id);
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'export-item';
            if (exportIcon) {
                itemDiv.className = 'export-item export-item--appIcon';
            }
            contentDiv.appendChild(itemDiv);

            const checkboxWrap = document.createElement('label');
            checkboxWrap.className = 'export-item__checkbox';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = '_' + item.id;
            checkbox.className = 'checkbox';
            checkbox.checked = true;
            if (!exportIcon) {
                checkboxWrap.appendChild(checkbox);
            }
            itemDiv.appendChild(checkboxWrap);

            const thumb = document.createElement('div');
            thumb.className = 'export-item__thumb';
            const image = document.createElement('img');
            if (item.data) {
                image.src = uint8ArrayToObjectURL(item.data);
            }
            if (item.base64) {
                image.src = item.base64;
            }
            thumb.appendChild(image);
            itemDiv.appendChild(thumb);

            const textWrap = document.createElement('div');
            textWrap.className = 'type type--11-pos export-item__text';
            const text = document.createElement('label');
            text.textContent = assetName;
            text.setAttribute('for', '_' + item.id);
            textWrap.appendChild(text);
            itemDiv.appendChild(textWrap);

            if (assetNames.includes(assetName)) {
                textWrap.classList.add('name-duplicated');
            }
            assetNames.push(assetName);

            if (!exportIcon) {
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        selectedCount ++;
                    } else {
                        selectedCount --;
                    }
                    if (selectedCount === assetsCount || selectedCount === 0) {
                        selectAllCheckbox.className = 'checkbox';
                        if (selectedCount === 0) {
                            selectAllCheckbox.checked = false;
                        } else {
                            selectAllCheckbox.checked = true;
                        }
                    } else {
                        selectAllCheckbox.className = 'checkbox checkbox--mix';
                        selectAllCheckbox.checked = true;
                    }
                    selectAllLabelText.textContent = `${selectedCount} / ${assetsCount}`;
                });
            }

            image.onclick = () => {
                parent.postMessage({
                    pluginMessage: {
                        type: 'showLayer',
                        id: item.id
                    }
                }, '*');
            };
        }
    });

    selectAllCheckbox.onchange = () => {
        for (let i = 0; i < contentDiv.children.length; i++) {
            const checkbox = contentDiv.children[i].firstChild.firstChild;
            (<HTMLInputElement> checkbox).checked = selectAllCheckbox.checked;
        }
        if (selectAllCheckbox.checked) {
            selectedCount = assetsCount;
        } else {
            selectedCount = 0;
        }
        selectAllCheckbox.className = 'checkbox';
        selectAllLabelText.textContent = `${selectedCount} / ${assetsCount}`;
    };

    // Export button
    exportButton.onclick = () => {
        if (selectedCount === 0) {
            parent.postMessage({
                pluginMessage: {
                    type: 'notify',
                    text: 'Please select at least 1 asset to export.'
                }
            }, '*');
            return;
        }
        exportButton.disabled = true;
        const zip = new JSZip();
        for (let file of assets) {
            const fileSelected = exportIcon ? true : (<HTMLInputElement> document.getElementById('_' + file.id)).checked;
            if (fileSelected) {
                if (file.data) {
                    zip.file(file.path, file.data);
                }
                if (file.base64) {
                    zip.file(file.path, file.base64.replace('data:image/png;base64,', ''), {base64: true});
                }
            }
        }
        // Adaptive icon XML
        if (exportIcon) {
            const xml = '<?xml version="1.0" encoding="utf-8"?>\n' +
                '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
                '    <background android:drawable="@mipmap/ic_launcher_background" />\n' +
                '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n' +
                '</adaptive-icon>';
            zip.file('mipmap-anydpi-v26/ic_launcher.xml', xml);
        }
        zip.generateAsync({type: 'blob'}).then((content: Blob) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);;
            link.download = 'assets_' + formatDate() + '.zip';
            link.click();
        });
        exportButton.disabled = false;
    };
}

async function getPNGAssetsFromPluginMessage(pluginMessage: any): Promise<{id: string, path: string, data: Uint8Array} []> {
    let assets: any [] = [];
    for (const exportImage of pluginMessage.exportImages) {
        for (const item of exportImage) {
            assets.push({
                id: item.id,
                path: item.path,
                data: item.imageData
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

// interface NinePatchAssetPatch {
//     width: number,
//     height: number,
//     imageData: Uint8Array
// }
// interface NinePatchAssetContent {
//     scale: number,
//     width: number,
//     height: number,
//     path: string,
//     imageData: Uint8Array
// }
// interface NinePatchAsset {
//     id: string,
//     name: string,
//     patchImage: NinePatchAssetPatch,
//     contentImages: NinePatchAssetContent[]
// }
async function getNinePatchAssetsFromPluginMessage(pluginMessage: any): Promise<{id: string, path: string, base64: string} []> {
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
            // Content
            ctx.putImageData(contentData, 1, 1);
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
            assets.push({
                id: ninePatchImage.id,
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
    let originalWidth: number;
    let originalHeight: number;
    let width = 1;
    let height = 1;
    if (side === 'top') {
        originalWidth = data.width - 2;
        originalHeight = 1;
        width = Math.round(originalWidth * scale);
        originalPatchLineData = data.data.slice(4, originalWidth * 4 + 4);
    }
    if (side === 'right') {
        originalWidth = 1;
        originalHeight = data.height - 2;
        height = Math.round(originalHeight * scale);
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
        width = Math.round(originalWidth * scale);
        originalPatchLineData = data.data.slice(data.width * (data.height - 1) * 4 + 4, originalWidth * 4 + data.width * (data.height - 1) * 4 + 4);
    }
    if (side === 'left') {
        originalWidth = 1;
        originalHeight = data.height - 2;
        height = Math.round(originalHeight * scale);
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

function uint8ArrayToObjectURL(data: Uint8Array): string {
    return URL.createObjectURL(new Blob([data], { type: 'image/png' }));
}

function formatDate(): string {
    let d = new Date();
    let result = '' + d.getFullYear();
    result += (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1);
    result += (d.getDate() < 10 ? '0' : '') + d.getDate();
    result += (d.getHours() < 10 ? '0' : '') + d.getHours();
    result += (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    result += (d.getSeconds() < 10 ? '0' : '') + d.getSeconds();
    return result;
}