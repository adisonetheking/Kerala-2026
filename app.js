const API_URL = 'https://api.opendatakerala.org/api/kla2026/results/all.json';
const UPDATE_INTERVAL = 60000; // Update every minute

let electionData = [];

// DOM Elements
const resultsBody = document.getElementById('resultsBody');
const ldfSeats = document.getElementById('ldfSeats');
const udfSeats = document.getElementById('udfSeats');
const ndaSeats = document.getElementById('ndaSeats');
const othSeats = document.getElementById('othSeats');
const ldfBar = document.getElementById('ldfBar');
const udfBar = document.getElementById('udfBar');
const ndaBar = document.getElementById('ndaBar');
const othBar = document.getElementById('othBar');
const leadingAlliance = document.getElementById('leadingAlliance');
const lastUpdated = document.getElementById('lastUpdated');
const searchInput = document.getElementById('searchInput');
const loader = document.getElementById('loader');
const dataSourceBadge = document.getElementById('dataSourceBadge');

// Modal Elements
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const totalVoters = document.getElementById('totalVoters');
const pollingPercentage = document.getElementById('pollingPercentage');
const candidateList = document.getElementById('candidateList');
const closeModal = document.getElementById('closeModal');

async function fetchData() {
    try {
        console.log('Fetching live data...');
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();
        
        dataSourceBadge.textContent = 'Live Data';
        dataSourceBadge.className = 'status-badge live';
        
        processData(json.data);
        hideLoader();
    } catch (error) {
        console.error('Fetch error:', error);
        
        dataSourceBadge.textContent = 'Simulated Mode';
        dataSourceBadge.className = 'status-badge simulated';
        
        simulateData();
        hideLoader();
    }
}

function processData(data) {
    electionData = data.map(item => {
        const constituency = item.constituency;
        const candidates = item.candidates.sort((a, b) => b.votes - a.votes);

        const winner = candidates[0];
        const runnerUp = candidates[1] || { votes: 0 };
        const margin = winner.votes - runnerUp.votes;

        return {
            id: constituency.constituency_Number,
            name: constituency.constituency_Name,
            district: constituency.district,
            totalVoters: constituency['Voters Total'] || "N/A",
            pollingPercent: constituency['Polling % (2026)'] || "N/A",
            candidates: candidates, // Store all candidates for the modal
            winner: winner,
            margin: margin,
            status: margin > 5000 ? 'Decisive Lead' : 'Close Contest'
        };
    });

    updateUI();
}

function updateUI() {
    const summary = { LDF: 0, UDF: 0, NDA: 0, others: 0 };

    electionData.forEach(item => {
        const alliance = item.winner.alliance;
        if (summary[alliance] !== undefined) {
            summary[alliance]++;
        } else {
            summary['others']++;
        }
    });

    ldfSeats.textContent = summary.LDF;
    udfSeats.textContent = summary.UDF;
    ndaSeats.textContent = summary.NDA;
    othSeats.textContent = summary.others;

    const total = 140;
    ldfBar.style.width = `${(summary.LDF / total) * 100}%`;
    udfBar.style.width = `${(summary.UDF / total) * 100}%`;
    ndaBar.style.width = `${(summary.NDA / total) * 100}%`;
    othBar.style.width = `${(summary.others / total) * 100}%`;

    const alliances = [
        { name: 'LDF', count: summary.LDF },
        { name: 'UDF', count: summary.UDF },
        { name: 'NDA', count: summary.NDA }
    ].sort((a, b) => b.count - a.count);

    if (alliances[0].count >= 71) {
        leadingAlliance.textContent = `${alliances[0].name} has Majority!`;
    } else {
        leadingAlliance.textContent = `${alliances[0].name} is Leading`;
    }

    lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    renderTable();
}

function renderTable() {
    const query = searchInput.value.toLowerCase();

    // Optimized Filtering: Check Constituency, District, and Party
    const displayData = electionData.filter(item =>
        item.name.toLowerCase().includes(query) ||
        item.district.toLowerCase().includes(query) ||
        item.winner.party.toLowerCase().includes(query) ||
        item.winner.alliance.toLowerCase().includes(query)
    );

    // Efficient Rendering: Using DocumentFragment to minimize reflows
    const fragment = document.createDocumentFragment();
    resultsBody.innerHTML = '';

    displayData.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => openDetails(item.id);
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>
                <div class="const-name">${item.name}</div>
                <div class="dist-name" style="font-size: 0.7rem; color: #8b949e;">${item.district}</div>
            </td>
            <td>
                <span class="candidate-lead">${item.winner.name}</span>
            </td>
            <td>
                <span class="party-tag ${item.winner.alliance.toLowerCase()}">${item.winner.party}</span>
            </td>
            <td>${item.margin.toLocaleString()}</td>
            <td><span class="status-tag">${item.status}</span></td>
        `;
        fragment.appendChild(tr);
    });

    resultsBody.appendChild(fragment);
}

// Performance Optimization: Debounce search to handle rapid typing efficiently
function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

const debouncedSearch = debounce(() => renderTable());

function openDetails(id) {
    const item = electionData.find(d => d.id === id);
    if (!item) return;

    modalTitle.textContent = item.name;
    modalSubtitle.textContent = item.district;
    totalVoters.textContent = item.totalVoters.toLocaleString();
    pollingPercentage.textContent = item.pollingPercent + '%';

    candidateList.innerHTML = '';
    const maxVotes = item.candidates[0].votes;

    item.candidates.forEach(cand => {
        const votePercent = maxVotes > 0 ? (cand.votes / maxVotes) * 100 : 0;
        const row = document.createElement('div');
        row.className = 'candidate-row';
        row.innerHTML = `
            <div class="cand-info">
                <div class="cand-name-party">
                    <span class="cand-name">${cand.name}</span>
                    <span class="cand-party">${cand.party} (${cand.alliance})</span>
                </div>
                <div class="cand-votes">${cand.votes.toLocaleString()}</div>
            </div>
            <div class="vote-bar-bg">
                <div class="vote-bar-fill ${cand.alliance.toLowerCase()}" style="width: ${votePercent}%; background-color: var(--${cand.alliance.toLowerCase()}-color, #6e7681)"></div>
            </div>
        `;
        candidateList.appendChild(row);
    });

    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling background
}

function closeDetails() {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

function hideLoader() {
    loader.classList.add('hidden');
}

function simulateData() {
    const districts = ['Kasaragod', 'Kannur', 'Wayanad', 'Kozhikode', 'Malappuram', 'Palakkad', 'Thrissur', 'Ernakulam', 'Idukki', 'Kottayam', 'Alappuzha', 'Pathanamthitta', 'Kollam', 'Thiruvananthapuram'];
    const alliances = ['LDF', 'UDF', 'NDA', 'others'];
    const parties = { 'LDF': 'CPI(M)', 'UDF': 'INC', 'NDA': 'BJP', 'others': 'IND' };

    const mockData = [];
    for (let i = 1; i <= 140; i++) {
        const alliance = alliances[Math.floor(Math.random() * 3)];
        const votes1 = Math.floor(Math.random() * 80000) + 20000;
        const votes2 = votes1 - Math.floor(Math.random() * 10000);

        mockData.push({
            constituency: {
                constituency_Number: i.toString(),
                constituency_Name: `Constituency ${i}`,
                district: districts[Math.floor(Math.random() * districts.length)],
                'Voters Total': 220000,
                'Polling % (2026)': 78.5
            },
            candidates: [
                { name: `Candidate A${i}`, alliance: alliance, party: parties[alliance], votes: votes1 },
                { name: `Candidate B${i}`, alliance: alliances.find(a => a !== alliance), party: 'Runner Up Party', votes: votes2 },
                { name: `Candidate C${i}`, alliance: 'others', party: 'Independent', votes: Math.floor(votes2 / 2) }
            ]
        });
    }
    processData(mockData);
}

// Event Listeners
searchInput.addEventListener('input', debouncedSearch);
closeModal.onclick = closeDetails;
modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeDetails(); };

// Initialize
fetchData();
setInterval(fetchData, UPDATE_INTERVAL);
