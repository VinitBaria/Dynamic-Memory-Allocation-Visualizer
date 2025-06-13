let partitions = [];
let processCount = 0;
let lastAllocatedIndex = 0;
let isAllFitsMode = false;
let fitPartitions = {};

function updatePartitionInputs() {
    const numPartitions = parseInt(document.getElementById('numPartitions').value);
    const sizesDiv = document.getElementById('partitionSizes');
    sizesDiv.innerHTML = '';

    for (let i = 0; i < numPartitions; i++) {
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '1';
        input.value = partitions[i]?.size || '100';
        input.id = `size-${i}`;
        input.placeholder = `P${i} Size`;
        sizesDiv.appendChild(input);
    }
    initializeMemory();
}

function updateAllPartitions() {
    const numPartitions = parseInt(document.getElementById('numPartitions').value);
    let allValid = true;
    let totalUsed = [];

    for (let i = 0; i < numPartitions; i++) {
        totalUsed[i] = partitions[i]?.processes?.reduce((sum, p) => sum + p.size, 0) || 0;
        const newSize = parseInt(document.getElementById(`size-${i}`).value);
        if (totalUsed[i] > newSize) {
            updateLog(`Cannot update Partition ${i} - New size (${newSize}KB) too small for processes (${totalUsed[i]}KB)`);
            allValid = false;
        }
    }

    if (allValid) {
        for (let i = 0; i < numPartitions; i++) {
            const newSize = parseInt(document.getElementById(`size-${i}`).value);
            if (partitions[i]) {
                partitions[i].size = newSize;
                partitions[i].remaining = newSize - (partitions[i].processes.reduce((sum, p) => sum + p.size, 0) || 0);
            }
        }
        initializeMemory();
        if (isAllFitsMode) initializeAllFits();
        updateLog('All partition sizes updated');
    }
}

function initializeMemory(displayId = 'memoryDisplay', partitionsToUse = partitions) {
    const numPartitions = parseInt(document.getElementById('numPartitions').value);
    const display = document.getElementById(displayId);
    display.innerHTML = '';
    const oldPartitions = displayId === 'memoryDisplay' ? [...partitions] : JSON.parse(JSON.stringify(partitionsToUse));
    if (displayId === 'memoryDisplay') partitions = [];

    for (let i = 0; i < numPartitions; i++) {
        const partitionSize = parseInt(document.getElementById(`size-${i}`).value) || 100;
        const oldPartition = oldPartitions[i];
        const partition = {
            id: i,
            size: partitionSize,
            processes: oldPartition?.processes || [],
            remaining: partitionSize - (oldPartition?.processes?.reduce((sum, p) => sum + p.size, 0) || 0)
        };
        if (displayId === 'memoryDisplay') partitions.push(partition);
        else fitPartitions[displayId.split('-')[1]][i] = partition;

        const container = document.createElement('div');
        container.className = 'partition-container';
        
        const div = document.createElement('div');
        div.className = 'partition';
        
        let processesHtml = '';
        if (partition.processes.length > 0) {
            partition.processes.forEach(proc => {
                const height = (proc.size / partitionSize) * 100;
                processesHtml += `<div class="process" style="height: ${height}%">${proc.id} (${proc.size}KB)</div>`;
            });
        }
        
        const info = document.createElement('div');
        info.className = 'partition-info';
        info.textContent = `Partition ${i} (${partitionSize}KB) - Remaining: ${partition.remaining}KB`;

        div.innerHTML = `<div class="memory-bar">${processesHtml}</div>`;
        container.appendChild(div);
        container.appendChild(info);
        display.appendChild(container);
    }
    if (displayId === 'memoryDisplay') {
        lastAllocatedIndex = Math.min(lastAllocatedIndex, numPartitions - 1);
        updateLog('Main memory display updated with ' + numPartitions + ' partitions');
    }
}

function allocateMemory(algorithmOverride = null, partitionsToUse = partitions, displayId = 'memoryDisplay') {
    const processSize = parseInt(document.getElementById('processSize').value);
    const algorithm = algorithmOverride || document.getElementById('algorithm').value;
    const process = { id: `P${processCount}`, size: processSize };
    let allocated = false;
    let targetPartition = null;
    let localLastAllocatedIndex = lastAllocatedIndex;

    const availablePartitions = partitionsToUse.filter(p => p.remaining >= processSize);

    switch(algorithm) {
        case 'first':
            targetPartition = availablePartitions[0];
            break;
        case 'next':
            for (let j = 0; j < partitionsToUse.length; j++) {
                const index = (localLastAllocatedIndex + j) % partitionsToUse.length;
                if (partitionsToUse[index].remaining >= processSize) {
                    targetPartition = partitionsToUse[index];
                    localLastAllocatedIndex = index + 1;
                    break;
                }
            }
            break;
        case 'best':
            targetPartition = availablePartitions.reduce((best, current) => 
                !best || (current.remaining - processSize < best.remaining - processSize) ? current : best, null);
            break;
        case 'worst':
            targetPartition = availablePartitions.reduce((worst, current) => 
                !worst || (current.remaining - processSize > worst.remaining - processSize) ? current : worst, null);
            break;
    }

    if (targetPartition) {
        targetPartition.processes.push(process);
        targetPartition.remaining -= processSize;

        const display = document.getElementById(displayId);
        const partitionContainer = display.children[targetPartition.id];
        const memoryBar = partitionContainer.querySelector('.memory-bar');
        const infoDiv = partitionContainer.querySelector('.partition-info');

        const processDiv = document.createElement('div');
        processDiv.className = 'process';
        processDiv.style.height = '0%';
        processDiv.textContent = `${process.id} (${process.size}KB)`;
        memoryBar.appendChild(processDiv);

        setTimeout(() => {
            processDiv.style.height = `${(processSize/targetPartition.size) * 100}%`;
        }, 10);

        infoDiv.textContent = `Partition ${targetPartition.id} (${targetPartition.size}KB) - Remaining: ${targetPartition.remaining}KB`;
        allocated = true;

        if (displayId === 'memoryDisplay') {
            lastAllocatedIndex = localLastAllocatedIndex;
            processCount++;
            updateLog(`Process ${process.id} (${processSize}KB) allocated to Partition ${targetPartition.id} using ${algorithm} fit in main display`);
        } else {
            updateLog(`Process ${process.id} (${processSize}KB) allocated to Partition ${targetPartition.id} using ${algorithm} fit`);
        }
    } else if (displayId === 'memoryDisplay') {
        updateLog(`Failed to allocate ${processSize}KB using ${algorithm} fit in main display - No suitable partition`);
    } else {
        updateLog(`Failed to allocate ${processSize}KB using ${algorithm} fit - No suitable partition`);
    }

    return allocated;
}

function initializeAllFits() {
    const allFitsDisplay = document.getElementById('allFitsDisplay');
    allFitsDisplay.innerHTML = '';
    const algorithms = ['first', 'next', 'best', 'worst'];
    const originalPartitions = JSON.parse(JSON.stringify(partitions));
    fitPartitions = {};

    const allocateAllBtn = document.createElement('button');
    allocateAllBtn.className = 'allocate-btn';
    allocateAllBtn.id = 'allocateAllBtn';
    allocateAllBtn.textContent = 'Allocate 5';
    allocateAllBtn.onclick = allocateAllFits;
    allFitsDisplay.appendChild(allocateAllBtn);

    algorithms.forEach((algorithm) => {
        const section = document.createElement('div');
        section.className = 'fit-section';
        
        const title = document.createElement('h2');
        title.textContent = `${algorithm.charAt(0).toUpperCase() + algorithm.slice(1)} Fit Simulation`;
        
        const display = document.createElement('div');
        display.id = `fitDisplay-${algorithm}`;
        display.className = 'memory-display';
        
        section.appendChild(title);
        section.appendChild(display);
        allFitsDisplay.appendChild(section);

        fitPartitions[algorithm] = JSON.parse(JSON.stringify(originalPartitions));
        initializeMemory(`fitDisplay-${algorithm}`, fitPartitions[algorithm]);
    });

    updateLog('All fit simulations initialized');
}

function allocateAllFits() {
    const algorithms = ['first', 'next', 'best', 'worst'];
    processCount++; // Increment only once for the same process
    algorithms.forEach(algorithm => {
        allocateMemory(algorithm, fitPartitions[algorithm], `fitDisplay-${algorithm}`);
    });
}

function deallocateMemory() {
    if (isAllFitsMode) return;

    const occupiedPartitions = partitions.filter(p => p.processes.length > 0);
    if (occupiedPartitions.length === 0) {
        updateLog('No processes to deallocate');
        return;
    }

    const partition = occupiedPartitions[Math.floor(Math.random() * occupiedPartitions.length)];
    const processToRemove = partition.processes.pop();
    partition.remaining += processToRemove.size;

    const partitionContainer = document.getElementById('memoryDisplay').children[partition.id];
    const memoryBar = partitionContainer.querySelector('.memory-bar');
    const processDiv = memoryBar.lastElementChild;
    const infoDiv = partitionContainer.querySelector('.partition-info');

    processDiv.style.height = '0%';
    updateLog(`Process ${processToRemove.id} deallocated from Partition ${partition.id}`);

    setTimeout(() => {
        memoryBar.removeChild(processDiv);
        infoDiv.textContent = `Partition ${partition.id} (${partition.size}KB) - Remaining: ${partition.remaining}KB`;
    }, 600);
}

function resetSimulation() {
    updatePartitionInputs();
    document.getElementById('allFitsDisplay').innerHTML = '';
    processCount = 0;
    isAllFitsMode = false;
    fitPartitions = {};
    document.getElementById('modeBtn').textContent = 'All Fits';
    toggleMode();
    updateLog('Simulation reset');
}

function toggleMode() {
    isAllFitsMode = !isAllFitsMode;
    const modeBtn = document.getElementById('modeBtn');
    const mainAllocateBtn = document.getElementById('mainAllocateBtn');
    const deallocateBtn = document.getElementById('deallocateBtn');

    if (isAllFitsMode) {
        modeBtn.textContent = 'Common Mode';
        mainAllocateBtn.disabled = true;
        deallocateBtn.disabled = true;
        initializeAllFits();
    } else {
        modeBtn.textContent = 'All Fits';
        mainAllocateBtn.disabled = false;
        deallocateBtn.disabled = false;
        document.getElementById('allFitsDisplay').innerHTML = '';
    }

    document.getElementById('allFitsDisplay').style.display = isAllFitsMode ? 'block' : 'none';
    document.getElementById('memoryDisplay').style.display = isAllFitsMode ? 'none' : 'block';
}

function updateLog(message) {
    const log = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    log.insertBefore(entry, log.firstChild);
}

window.onload = updatePartitionInputs;