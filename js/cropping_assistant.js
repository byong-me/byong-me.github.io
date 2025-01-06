let inputFilePicker = document.getElementById("file_input");
let inputFileName = "";
let inputCanvas = document.getElementById("input_canvas").getContext("2d");

function addImageFromFile(file) {
    let img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = function () {
        inputCanvas.canvas.width = img.width;
        inputCanvas.canvas.height = img.height;
        inputCanvas.drawImage(img, 0, 0);
        let output_list = document.getElementById("output_images_ul");
        output_list.innerHTML = ""; // Clear any old results
        detectBoundingBoxes("input_canvas");
        document.getElementById("output-card").classList.remove("d-none");
    };
}

function WindowDragEnterHandler(event) {
    event.preventDefault();
}

function WindowDragEndHandler(event) {
    event.preventDefault();
    document.getElementById("drop-target-visual").classList.remove("border-warning");
}

function WindowDragOverHandler(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "none";
    document.getElementById("drop-target-visual").classList.remove("border-success");
    document.getElementById("drop-target-visual").classList.add("border-warning");
}

function WindowDropHandler(event) {
    event.preventDefault();
}

function dragoverHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
    document.getElementById("drop-target-visual").classList.add("border-success");
}

function dropHandler(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files.length > 0) {
        let first_item = event.dataTransfer.files[0];
        if (first_item.type.match("^image/")) {
            inputFileName = first_item.name;
            addImageFromFile(first_item);
        }
    }
    document.getElementById("drop-target-visual").classList.remove("border-success");
}

window.addEventListener("dragenter", WindowDragEnterHandler);
window.addEventListener("dragend", WindowDragEndHandler);
window.addEventListener("dragleave", WindowDragEndHandler);
window.addEventListener("dragover", WindowDragOverHandler);
window.addEventListener("drop", WindowDropHandler);
document.getElementById("drop-target").addEventListener("drop", dropHandler);
document.getElementById("drop-target").addEventListener("dragover", dragoverHandler);

inputFilePicker.addEventListener("change", (e) => {
    inputFileName = e.target.files[0].name;
    addImageFromFile(e.target.files[0]);
}, false);

function rotateCanvasIdx(output_idx, degrees) {
    // Ensure the angle is one of the valid 90-degree multiples
    if (![90, 180, 270, -90].includes(degrees)) {
        throw new Error("Angle must be 90, 180, 270, or -90 degrees.");
    }

    let src = cv.imread(`output_canvas_${output_idx}`);
    let dst = new cv.Mat();

    // Build 90 degree rotation from flip+transpose
    // opencv.js doesn"t include the .rotate helper function
    switch (degrees) {
        case 90:
        case -270:
            cv.transpose(src, dst);
            cv.flip(dst, dst, 1);
            break;
        case 180:
        case -180:
            cv.flip(src, dst, -1);
            break;
        case 270:
        case -90:
            cv.transpose(src, dst);
            cv.flip(dst, dst, 0);
            break;
    }

    cv.imshow(`output_canvas_${output_idx}`, dst);
    src.delete();
    dst.delete();
}

function downloadCanvasIdx(output_idx) {
    let canvas = document.getElementById(`output_canvas_${output_idx}`);
    let filename = document.getElementById(`output_filename_${output_idx}`);
    let extension = document.getElementById(`output_extension_${output_idx}`);
    let link = document.createElement("a");
    const full_filename = filename.value + "." + extension.value;
    switch (extension.value) {
        case "jpg":
            var url = canvas.toDataURL(`image/jpeg`, 0.8).replace(`image/jpeg`, "image/octet-stream");
            break;
        case "png":
            var url = canvas.toDataURL(`image/png`).replace(`image/png`, "image/octet-stream");
            break;
        case "webp":
            var url = canvas.toDataURL(`image/webp`, 0.8).replace(`image/webp`, "image/octet-stream");
            break;
    }
    if (url) {
        link.setAttribute("download", full_filename);
        link.setAttribute("href", url);
        link.click();
    }
}

function addOutputImage(index, output_mat) {
    let item_li = document.createElement("li");
    const link = inputFileName.replaceAll("\\", "/");
    const fileName = link.substring(link.lastIndexOf("/") + 1, link.lastIndexOf(".")) || "scan";
    item_li.classList.add("list-group-item");
    item_li.innerHTML = `
        <div class="container-fluid">
            <div class="row">
                <div class="col">
                    <canvas id="output_canvas_${index}" class="mt-3 mb-3 mw-100" style="max-height: 30vh;"></canvas>
                    <div class="input-group">
                        <button type="button" class="btn btn-outline-secondary" title="Rotate left" onclick="rotateCanvasIdx(${index}, -90)">
                            <i class="fa-solid fa-rotate-left"></i>
                        </button>
                        <button type="button" class="btn btn-outline-secondary" title="Rotate right" onclick="rotateCanvasIdx(${index}, 90)">
                            <i class="fa-solid fa-rotate-right"></i>
                        </button>
                        <input type="text" class="form-control" id="output_filename_${index}" value="${fileName}_${index}">
                        <select class="form-select" id="output_extension_${index}">
                            <option selected value="jpg">.jpg</option>
                            <option value="png">.png</option>
                            <option value="webp">.webp</option>
                        </select>
                        <button type="button" class="btn btn-outline-secondary" title="Download" onclick="downloadCanvasIdx(${index})">
                            Download <i class="fa-solid fa-download"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    let output_list = document.getElementById("output_images_ul");
    output_list.appendChild(item_li);
    let item_canvas = document.getElementById(`output_canvas_${index}`);
    cv.imshow(item_canvas, output_mat);
}

function detectBoundingBoxes(input_canvas) {
    // Load the image from the input canvas
    let img = cv.imread(input_canvas);

    // Calculate the minimum area threshold (10% of the image area)
    let imageArea = img.rows * img.cols;
    let minArea = 0.1 * imageArea;

    // Get the dimensions of the image
    let imgWidth = img.cols;
    let imgHeight = img.rows;

    // Define the bounds with a 5% margin
    let xMin = -0.05 * imgWidth;
    let xMax = imgWidth * 1.05;
    let yMin = -0.05 * imgHeight;
    let yMax = imgHeight * 1.05;

    // Convert the image to grayscale
    let gray = new cv.Mat();
    cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY, 0);

    // Apply thresholding to create a binary image
    let binary = new cv.Mat();
    cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY_INV);

    // Find contours
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // Process each contour
    for (let i = 0; i < contours.size(); i++) {
        let contour = contours.get(i);

        // Get the minimum area rectangle for the contour
        let rect = cv.minAreaRect(contour);
        let box = cv.RotatedRect.points(rect);

        // Calculate the area of the bounding box
        let boxWidth = rect.size.width;
        let boxHeight = rect.size.height;
        let boxArea = boxWidth * boxHeight;

        // Skip small bounding boxes
        if (boxArea < minArea) {
            continue;
        }

        // Check if all points of the bounding box are within 5% of the image bounds
        let outOfBounds = false;
        for (let j = 0; j < box.length; j++) {
            if (
                box[j].x < xMin || box[j].x > xMax ||
                box[j].y < yMin || box[j].y > yMax
            ) {
                outOfBounds = true;
                break;
            }
        }

        if (outOfBounds) {
            continue;
        }

        // Expand the bounding box by 3%
        boxWidth *= 1.03;
        boxHeight *= 1.03;
        rect.size.width = boxWidth;
        rect.size.height = boxHeight;
        box = cv.RotatedRect.points(rect);

        // Extract the region of interest (ROI) using the expanded bounding box
        let dst = new cv.Mat();
        let dsize = new cv.Size(boxWidth, boxHeight);
        let srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            box[0].x, box[0].y,
            box[1].x, box[1].y,
            box[2].x, box[2].y,
            box[3].x, box[3].y
        ]);
        let dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, boxHeight - 1,
            0, 0,
            boxWidth - 1, 0,
            boxWidth - 1, boxHeight - 1
        ]);
        let M = cv.getPerspectiveTransform(srcPts, dstPts);
        cv.warpPerspective(img, dst, M, dsize);

        // Save the ROI to a canvas
        addOutputImage(i, dst);

        // Clean up
        srcPts.delete();
        dstPts.delete();
        M.delete();
        dst.delete();
    }

    // Clean up
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
    img.delete();
}
