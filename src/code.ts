
let command = figma.command;
let currentPage = figma.currentPage;
let selectedLayers = currentPage.selection;

const scaleToDpi = {
    1: 'mdpi',
    1.5: 'hdpi',
    2: 'xhdpi',
    3: 'xxhdpi',
    4: 'xxxhdpi'
};

if (command === 'export-png') {
    if (selectedLayers.length === 0) {
        showMessageAndExit('Please select at least 1 slice layer, exportable layer or group include slice.');
    } else {
        // Get all exportable layers
        let exportableLayers: any [] = [];
        selectedLayers.forEach(layer => {
            if (layer.type === 'SLICE' || (<ExportMixin> layer).exportSettings.length > 0) {
                exportableLayers.push(layer);
            }
            (<ChildrenMixin> layer).findAll(child => child.type === 'SLICE' || (<ExportMixin> child).exportSettings.length > 0).forEach(item => {
                exportableLayers.push(item);
            });
        });
        if (exportableLayers.length === 0) {
            showMessageAndExit('No exportable layers in selection.');
        } else {
            Promise.all(exportableLayers.map(layer => getExportImagesFromLayer(layer)))
            .then(exportImages => {
                figma.showUI(__html__, {width: 300, height: 150});
                figma.ui.postMessage({
                    type: 'export-png',
                    exportImages: exportImages
                });
            })
            .catch(error => {
                console.error(error);
                figma.closePlugin();
            });
        }
    }
}

if (command === 'new-nine-patch') {

    let hasNinePatchInSelectedLayers = selectedLayers.some(node => node.getPluginData('resourceType') === 'nine-patch');
    if (hasNinePatchInSelectedLayers) {
        showMessageAndExit('Selected layers have a nine-patch resource.');
    }
    else {

        // Get influence frame [top, right, bottom, left]
        let influenceFrame: number[] = [Infinity, -Infinity, -Infinity, Infinity];

        function traverse(node) {
            processLayer(node);
            if ("children" in node) {
                if (node.type !== "INSTANCE") {
                    for (const child of node.children) {
                        traverse(child)
                    }
                }
            }
        }

        function processLayer(layer) {
            const rotation = (<LayoutMixin> layer).rotation;
            const x = (<LayoutMixin> layer).x;
            const y = (<LayoutMixin> layer).y;
            const width = (<LayoutMixin> layer).width;
            const height = (<LayoutMixin> layer).height;
            const pi = Math.PI;
            let top: number;
            let right: number;
            let bottom: number;
            let left: number;

            if (rotation < 0) {
                top = y;
                right = x + Math.cos(rotation * pi / 180) * width;
                bottom = y + Math.cos(-rotation * pi / 180) * height + Math.sin(-rotation * pi / 180) * width;
                left = x - Math.sin(-rotation * pi / 180) * height;
            } else {
                top = y - Math.sin(rotation * pi / 180) * width;
                right = x + Math.cos(rotation * pi / 180) * width + Math.sin(rotation * pi / 180) * height;
                bottom = y + Math.cos(rotation * pi / 180) * height;
                left = x;
            }

            // Effects
            if ((<BlendMixin> layer).effects) {
                (<BlendMixin> layer).effects.forEach(effect => {
                    if (effect.type === 'DROP_SHADOW' && effect.visible === true) {
                        let xOffset = effect.offset.x;
                        let yOffset = effect.offset.y;
                        const blurRadius = effect.radius;
                        let shadowFrame: number[] = [top, right, bottom, left];
                        if (xOffset > 0) {
                            shadowFrame[1] += xOffset;
                        } else {
                            shadowFrame[3] += xOffset;
                        }
                        if (yOffset > 0) {
                            shadowFrame[2] += yOffset;
                        } else {
                            shadowFrame[0] += yOffset;
                        }
                        if (blurRadius > 0) {
                            if (yOffset < blurRadius) {
                                shadowFrame[0] -= blurRadius;
                            }
                            if (xOffset > -blurRadius) {
                                shadowFrame[1] += blurRadius;
                            }
                            if (yOffset > -blurRadius) {
                                shadowFrame[2] += blurRadius;
                            }
                            if (xOffset < blurRadius) {
                                shadowFrame[3] -= blurRadius;
                            }
                        }
                        top = Math.min(shadowFrame[0], top);
                        right = Math.max(shadowFrame[1], right);
                        bottom = Math.max(shadowFrame[2], bottom);
                        left = Math.min(shadowFrame[3], left);
                    }
                    if (effect.type === 'LAYER_BLUR' && effect.visible === true) {
                        const radius = effect.radius;
                        top -= radius;
                        right += radius;
                        bottom += radius;
                        left -= radius;
                    }
                });
            }

            influenceFrame[0] = Math.min(influenceFrame[0], top);
            influenceFrame[1] = Math.max(influenceFrame[1], right);
            influenceFrame[2] = Math.max(influenceFrame[2], bottom);
            influenceFrame[3] = Math.min(influenceFrame[3], left);
            influenceFrame[0] = Math.floor(influenceFrame[0]);
            influenceFrame[1] = Math.ceil(influenceFrame[1]);
            influenceFrame[2] = Math.ceil(influenceFrame[2]);
            influenceFrame[3] = Math.floor(influenceFrame[3]);
        }

        selectedLayers.forEach(layer => {
            traverse(layer);
        });

        // Group selection
        const lastSelectedLayer =  selectedLayers[selectedLayers.length - 1];
        const parent = lastSelectedLayer.parent;
        let groupContent = figma.group(selectedLayers, parent, parent.children.indexOf(lastSelectedLayer));
        groupContent.name = 'content';

        // Create patch lines
        let blackColorFill: SolidPaint = {type: 'SOLID', color: {r: 0, g: 0, b: 0}};
        let leftPatch = figma.createRectangle();
        leftPatch.name = 'left';
        leftPatch.x = influenceFrame[3] - 1;
        leftPatch.y = influenceFrame[0];
        leftPatch.resize(1, influenceFrame[2] - influenceFrame[0]);
        leftPatch.fills = [blackColorFill];

        let topPatch = figma.createRectangle();
        topPatch.name = 'top';
        topPatch.x = influenceFrame[3];
        topPatch.y = influenceFrame[0] - 1;
        topPatch.resize(influenceFrame[1] - influenceFrame[3], 1);
        topPatch.fills = [blackColorFill];

        let rightPatch = figma.createRectangle();
        rightPatch.name = 'right';
        rightPatch.x = influenceFrame[1];
        rightPatch.y = influenceFrame[0];
        rightPatch.resize(1, influenceFrame[2] - influenceFrame[0]);
        rightPatch.fills = [blackColorFill];

        let bottomPath = figma.createRectangle();
        bottomPath.name = 'bottom';
        bottomPath.x = influenceFrame[3];
        bottomPath.y = influenceFrame[2];
        bottomPath.resize(influenceFrame[1] - influenceFrame[3], 1);
        bottomPath.fills = [blackColorFill];

        let groupPathIndex = groupContent.parent.children.indexOf(groupContent) + 1;
        let groupPatch = figma.group([leftPatch, topPatch, rightPatch, bottomPath], groupContent.parent, groupPathIndex);
        groupPatch.name = 'patch';
        groupPatch.x = influenceFrame[3] - 1;
        groupPatch.y = influenceFrame[0] - 1;

        // Group all
        let groupAllIndex = groupPatch.parent.children.indexOf(groupPatch) + 1;
        let groupAll = figma.group([groupContent, groupPatch], groupPatch.parent, groupAllIndex);
        groupAll.name = toAndroidResourceName(lastSelectedLayer.name);
        figma.currentPage.selection = [groupAll];

        // Set plugin data
        groupAll.setPluginData('resourceType', 'nine-patch');
    }

    figma.closePlugin();
}

if (command === 'export-nine-patch') {
    if (selectedLayers.length === 0) {
        showMessageAndExit('Please select at least 1 nine-patch asset.');
    } else {
        let ninePatchAssets: any [] = [];
        selectedLayers.forEach(layer => {
            if (
                layer.type === 'GROUP' &&
                layer.getPluginData('resourceType') === 'nine-patch' &&
                (<ChildrenMixin> layer).findOne(child => child.name === 'patch') &&
                (<ChildrenMixin> layer).findOne(child => child.name === 'content')
            ) {
                ninePatchAssets.push(layer);
            }
        });
        if (ninePatchAssets.length === 0) {
            showMessageAndExit('No any nine-patch asset in selection.');
        } else {
            Promise.all(ninePatchAssets.map(layer => getExportNinePatchFromLayer(layer)))
            .then(exportNinePatchAssets => {
                console.log(exportNinePatchAssets)
                figma.showUI(__html__, {width: 300, height: 150});
                figma.ui.postMessage({
                    type: 'export-nine-patch',
                    exportImages: exportNinePatchAssets
                });
            })
            .catch(error => {
                console.error(error);
                figma.closePlugin();
            });
        }
    }
}

if (command === 'new-app-icon') {
    figma.showUI(__html__, {visible: false});
    figma.ui.postMessage('new-app-icon');
    figma.ui.onmessage = (images) => {
        // New page
        const newPage = figma.createPage();
        newPage.name = 'app icon';

        // Old 48dp app launcher icon
        createFrameWithGrid(0, 0, 48, 48, 0, 0, 48, 48, 'ic_launcher', images.old_icon_grid, newPage);

        // 108dp adaptive icon
        createFrameWithGrid(98, 0, 108, 108, 0, 0, 108, 108, 'ic_background', images.adaptive_icon_grid, newPage);
        createFrameWithGrid(256, 0, 108, 108, 0, 0, 108, 108, 'ic_foreground', images.adaptive_icon_grid, newPage);

        // Google play icon 512px
        createFrameWithGrid(414, 0, 512, 512, 64, 64, 384, 384, 'google_play_icon', images.old_icon_grid, newPage);

        figma.closePlugin();
    };

    function createFrameWithGrid(
        x1: number, y1: number, width1: number, height1: number,
        x2: number, y2: number, width2: number, height2: number,
        name: string,
        image: Uint8Array,
        parent: ChildrenMixin
    ) {
        const frame = figma.createFrame();
        frame.name = name;
        frame.x = x1;
        frame.y = y1;
        frame.resize(width1, height1);
        const grid = figma.createRectangle();
        grid.name = 'grid';
        grid.x = x2;
        grid.y = y2;
        grid.resize(width2, height2);
        const paint: ImagePaint = {
            type: 'IMAGE',
            scaleMode: 'FILL',
            imageHash: figma.createImage(image).hash
        };
        grid.fills = [paint];
        frame.appendChild(grid);
        parent.appendChild(frame);
    }
}

async function getExportImagesFromLayer(layer: any): Promise<any []> {
    let assetName = toAndroidResourceName(layer.name);
    let androidExportSettings: ExportSettingsImage [] = [];
    for (let key in scaleToDpi) {
        androidExportSettings.push({
            format: 'PNG',
            constraint: {type: 'SCALE', value: Number(key)}
        });
    }
    let images = await Promise.all(androidExportSettings.map(async item => {
        let contentImage = await (<ExportMixin> layer).exportAsync(item);
        let scale = item.constraint.value;
        return {
            width: Math.round(layer.width * scale),
            height: Math.round(layer.height * scale),
            path: 'drawable-' + scaleToDpi[scale] + '/' + assetName + '.png',
            imageData: contentImage
        };
    }));
    return images;
}

async function getExportNinePatchFromLayer(layer: any): Promise<any> {
    let patch = (<ChildrenMixin> layer).findOne(node => node.name === 'patch');
    let content = (<ChildrenMixin> layer).findOne(node => node.name === 'content');
    if (!patch && !content) return;

    // Create slice
    let assetName = toAndroidResourceName(layer.name);
    let contentSlice = figma.createSlice();
    contentSlice.name = assetName;
    contentSlice.x = (<LayoutMixin> layer).x + 1;
    contentSlice.y = (<LayoutMixin> layer).y + 1;
    contentSlice.resize((<LayoutMixin> layer).width - 2, (<LayoutMixin> layer).height - 2);
    (<ChildrenMixin> content).appendChild(contentSlice);
    let exportSettings: ExportSettingsImage [] = [];
    for (let key in scaleToDpi) {
        exportSettings.push({
            format: 'PNG',
            constraint: {type: 'SCALE', value: Number(key)}
        });
    }
    contentSlice.exportSettings = exportSettings;

    let patchImageData = await (<ExportMixin> patch).exportAsync();
    let contentImages = await Promise.all(exportSettings.map(async item => {
        let contentImage = await (<ExportMixin> contentSlice).exportAsync(item);
        let scale = item.constraint.value;
        return {
            scale: scale,
            width: Math.round(contentSlice.width * scale),
            height: Math.round(contentSlice.height * scale),
            path: 'drawable-' + scaleToDpi[scale] + '/' + assetName + '.9.png',
            imageData: contentImage
        };
    }));

    contentSlice.remove();

    return {
        name: assetName,
        patchImage: {
            width: (<LayoutMixin> patch).width,
            height: (<LayoutMixin> patch).height,
            imageData: patchImageData
        },
        contentImages: contentImages
    };

    // figma.showUI(__html__, {visible: true, width: 400, height: 300});

    // figma.ui.postMessage({
    //     type: 'export-nine-patch',
    //     name: assetName,
    //     patchImage: {
    //         width: (<LayoutMixin> patch).width,
    //         height: (<LayoutMixin> patch).height,
    //         imageData: patchImageData
    //     },
    //     contentImages
    // });

    // // Remove slice layer and close plugin
    // const postMessage = await new Promise((resolve, reject) => {
    //     figma.ui.onmessage = value => resolve(value);
    // });
    // if (postMessage === 'done') {
    //     contentSlice.remove();
    //     figma.closePlugin();
    // }
}

function toAndroidResourceName(name: string) : string {
    // Latin to ascii
    var latinToAsciiMapping = {
        'ae': 'ä|æ|ǽ',
        'oe': 'ö|œ',
        'ue': 'ü',
        'Ae': 'Ä',
        'Ue': 'Ü',
        'Oe': 'Ö',
        'A': 'À|Á|Â|Ã|Ä|Å|Ǻ|Ā|Ă|Ą|Ǎ',
        'a': 'à|á|â|ã|å|ǻ|ā|ă|ą|ǎ|ª',
        'C': 'Ç|Ć|Ĉ|Ċ|Č',
        'c': 'ç|ć|ĉ|ċ|č',
        'D': 'Ð|Ď|Đ',
        'd': 'ð|ď|đ',
        'E': 'È|É|Ê|Ë|Ē|Ĕ|Ė|Ę|Ě',
        'e': 'è|é|ê|ë|ē|ĕ|ė|ę|ě',
        'G': 'Ĝ|Ğ|Ġ|Ģ',
        'g': 'ĝ|ğ|ġ|ģ',
        'H': 'Ĥ|Ħ',
        'h': 'ĥ|ħ',
        'I': 'Ì|Í|Î|Ï|Ĩ|Ī|Ĭ|Ǐ|Į|İ',
        'i': 'ì|í|î|ï|ĩ|ī|ĭ|ǐ|į|ı',
        'J': 'Ĵ',
        'j': 'ĵ',
        'K': 'Ķ',
        'k': 'ķ',
        'L': 'Ĺ|Ļ|Ľ|Ŀ|Ł',
        'l': 'ĺ|ļ|ľ|ŀ|ł',
        'N': 'Ñ|Ń|Ņ|Ň',
        'n': 'ñ|ń|ņ|ň|ŉ',
        'O': 'Ò|Ó|Ô|Õ|Ō|Ŏ|Ǒ|Ő|Ơ|Ø|Ǿ',
        'o': 'ò|ó|ô|õ|ō|ŏ|ǒ|ő|ơ|ø|ǿ|º',
        'R': 'Ŕ|Ŗ|Ř',
        'r': 'ŕ|ŗ|ř',
        'S': 'Ś|Ŝ|Ş|Š',
        's': 'ś|ŝ|ş|š|ſ',
        'T': 'Ţ|Ť|Ŧ',
        't': 'ţ|ť|ŧ',
        'U': 'Ù|Ú|Û|Ũ|Ū|Ŭ|Ů|Ű|Ų|Ư|Ǔ|Ǖ|Ǘ|Ǚ|Ǜ',
        'u': 'ù|ú|û|ũ|ū|ŭ|ů|ű|ų|ư|ǔ|ǖ|ǘ|ǚ|ǜ',
        'Y': 'Ý|Ÿ|Ŷ',
        'y': 'ý|ÿ|ŷ',
        'W': 'Ŵ',
        'w': 'ŵ',
        'Z': 'Ź|Ż|Ž',
        'z': 'ź|ż|ž',
        'AE': 'Æ|Ǽ',
        'ss': 'ß',
        'IJ': 'Ĳ',
        'ij': 'ĳ',
        'OE': 'Œ',
        'f': 'ƒ',
    };
    for (var i in latinToAsciiMapping) {
        var regexp = new RegExp(latinToAsciiMapping[i], 'g');
        name = name.replace(regexp, i);
    }
    // Remove no ascii character
    name = name.replace(/[^\u0020-\u007E]/g, '');
    // Remove not support character
    name = name.replace(/[\u0021-\u002B\u003A-\u0040\u005B-\u005E\u0060\u007B-\u007E]/g, '');
    // Remove Unix hidden file
    name = name.replace(/^\./, '');
    // Remove digit
    name = name.replace(/^\d+/, '');
    // Replace , - . to _
    name = name.replace(/[\u002C-\u002E\u005F]/g, '_');
    name = name.trim();
    // Replace space to _
    name = name.replace(/\s+/g, "_");
    name = name.toLowerCase();
    return name === '' ? 'untitled' : name;
}

function showMessageAndExit(message: string) {
    figma.showUI(__html__, {visible: true, width: 300, height: 120});
    figma.ui.postMessage({
        type: 'show-message',
        text: message
    });
    const close = () => {
        figma.closePlugin();
    };
    setTimeout(close, 3000);
}
