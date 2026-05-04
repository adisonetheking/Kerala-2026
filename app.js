const REMOTE_API_URL = 'https://api.opendatakerala.org/api/kla2026/results/all.json';
const PROXY_API_URL = '/api/election-results';
const UPDATE_INTERVAL = 6000;

let electionData = [];
let currentFilterAlliance = '';
let comparisonChart = null;

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
const tickerContent = document.getElementById('tickerContent');

// Analytics Elements
const districtGrid = document.getElementById('districtGrid');
const keyBattlesList = document.getElementById('keyBattlesList');
const regionStats = document.getElementById('regionStats');
const ldfProj = document.getElementById('ldfProj');
const udfProj = document.getElementById('udfProj');
const ndaProj = document.getElementById('ndaProj');

// Modal Elements
const filterModalOverlay = document.getElementById('filterModalOverlay');
const filterResultsBody = document.getElementById('filterResultsBody');
const modalOverlay = document.getElementById('modalOverlay');
const candidateList = document.getElementById('candidateList');

async function fetchData() {
    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const targetUrl = isLocal ? REMOTE_API_URL : PROXY_API_URL;
        const response = await fetch(targetUrl);
        if (!response.ok) throw new Error('Network response was not ok');
        const json = await response.json();
        dataSourceBadge.textContent = 'Live Data';
        dataSourceBadge.className = 'status-badge live';
        processData(json.data);
    } catch (error) {
        console.error('Fetch error:', error);
        dataSourceBadge.textContent = 'Simulated Mode';
        dataSourceBadge.className = 'status-badge simulated';
        simulateData();
    } finally {
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

        const north = ['Kasaragod', 'Kannur', 'Wayanad', 'Kozhikode', 'Malappuram', 'Palakkad'];
        const central = ['Thrissur', 'Ernakulam', 'Idukki', 'Kottayam'];
        const region = north.includes(constituency.district) ? 'North' : (central.includes(constituency.district) ? 'Central' : 'South');

        return {
            id: constituency.constituency_Number,
            name: constituency.constituency_Name,
            district: constituency.district,
            region: region,
            totalVoters: constituency['Voters Total'] || 0,
            pollingPercent: constituency['Polling % (2026)'] || 0,
            candidates: candidates,
            winner: winner,
            runnerUp: runnerUp,
            margin: margin,
            status: margin > 5000 ? 'Decisive Lead' : 'Close Contest'
        };
    });
    updateUI();

    try {
        updateAnalytics();
    } catch (e) {
        console.warn('Analytics failed:', e);
    }

    updateTicker();
}

function updateUI() {
    const summary = { LDF: 0, UDF: 0, NDA: 0, others: 0 };
    electionData.forEach(item => {
        const alliance = item.winner.alliance;
        if (summary[alliance] !== undefined) summary[alliance]++;
        else summary['others']++;
    });

    if (ldfSeats) ldfSeats.textContent = summary.LDF;
    if (udfSeats) udfSeats.textContent = summary.UDF;
    if (ndaSeats) ndaSeats.textContent = summary.NDA;
    if (othSeats) othSeats.textContent = summary.others;

    const total = 140;
    if (ldfBar) ldfBar.style.width = `${(summary.LDF / total) * 100}%`;
    if (udfBar) udfBar.style.width = `${(summary.UDF / total) * 100}%`;
    if (ndaBar) ndaBar.style.width = `${(summary.NDA / total) * 100}%`;
    if (othBar) othBar.style.width = `${(summary.others / total) * 100}%`;

    const seatsCounted = summary.LDF + summary.UDF + summary.NDA + summary.others;
    if (seatsCounted > 0) {
        if (ldfProj) ldfProj.textContent = Math.round((summary.LDF / seatsCounted) * 140);
        if (udfProj) udfProj.textContent = Math.round((summary.UDF / seatsCounted) * 140);
        if (ndaProj) ndaProj.textContent = Math.round((summary.NDA / seatsCounted) * 140);
    }

    if (lastUpdated) lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    renderTable();
    if (!filterModalOverlay.classList.contains('hidden')) renderFilterModal();
}

function updateAnalytics() {
    const voteTotals = { LDF: 0, UDF: 0, NDA: 0, others: 0 };
    const seatTotals = { LDF: 0, UDF: 0, NDA: 0, others: 0 };
    const regionData = { North: { LDF: 0, UDF: 0, NDA: 0, others: 0, total: 0 }, Central: { LDF: 0, UDF: 0, NDA: 0, others: 0, total: 0 }, South: { LDF: 0, UDF: 0, NDA: 0, others: 0, total: 0 } };
    const districtStats = {};

    electionData.forEach(item => {
        const alliance = item.winner.alliance !== undefined ? item.winner.alliance : 'others';
        seatTotals[alliance]++;

        if (!regionData[item.region][alliance]) regionData[item.region][alliance] = 0;
        regionData[item.region][alliance]++;
        regionData[item.region].total++;

        if (!districtStats[item.district]) districtStats[item.district] = { LDF: 0, UDF: 0, NDA: 0, others: 0 };
        districtStats[item.district][alliance]++;

        item.candidates.forEach(cand => {
            const candAlliance = cand.alliance !== undefined ? cand.alliance : 'others';
            if (voteTotals[candAlliance] !== undefined) voteTotals[candAlliance] += cand.votes;
            else voteTotals['others'] += cand.votes;
        });
    });

    updateComparisonChart(voteTotals, seatTotals);
    renderRegionalStats(regionData);
    renderDistrictGrid(districtStats);

    const narrowMargins = [...electionData].sort((a, b) => a.margin - b.margin).slice(0, 5);
    renderKeyBattles(narrowMargins);
}

function updateComparisonChart(voteTotals, seatTotals) {
    const canvas = document.getElementById('comparisonChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    const totalVotes = Object.values(voteTotals).reduce((a, b) => a + b, 0) || 1;
    const voteShares = [(voteTotals.LDF / totalVotes) * 100, (voteTotals.UDF / totalVotes) * 100, (voteTotals.NDA / totalVotes) * 100, (voteTotals.others / totalVotes) * 100];
    const seatShares = [(seatTotals.LDF / 140) * 100, (seatTotals.UDF / 140) * 100, (seatTotals.NDA / 140) * 100, (seatTotals.others / 140) * 100];

    if (comparisonChart) {
        comparisonChart.data.datasets[0].data = voteShares;
        comparisonChart.data.datasets[1].data = seatShares;
        comparisonChart.update();
    } else {
        comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['LDF', 'UDF', 'NDA', 'OTH'],
                datasets: [
                    { label: 'Vote Share %', data: voteShares, backgroundColor: 'rgba(88, 166, 255, 0.4)', borderColor: '#58a6ff', borderWidth: 1 },
                    { label: 'Seat Share %', data: seatShares, backgroundColor: 'rgba(255, 62, 62, 0.4)', borderColor: '#ff3e3e', borderWidth: 1 }
                ]
            },
            options: { indexAxis: 'y', responsive: true, plugins: { legend: { labels: { color: '#8b949e' } } }, scales: { x: { grid: { color: '#161b22' }, ticks: { color: '#8b949e' } }, y: { grid: { display: false }, ticks: { color: '#8b949e' } } } }
        });
    }
}

function renderDistrictGrid(stats) {
    if (!districtGrid) return;
    districtGrid.innerHTML = '';
    Object.entries(stats).forEach(([name, counts]) => {
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const leader = sorted[0][0];
        const leaderCount = sorted[0][1];
        const card = document.createElement('div');
        card.className = 'dist-stat-card';
        card.innerHTML = `<span class="dist-stat-name">${name}</span><span class="dist-lead-tag ${leader.toLowerCase()}" style="background: var(--${leader.toLowerCase()}-color, #6e7681); color: white;">${leader}: ${leaderCount}</span>`;
        districtGrid.appendChild(card);
    });
}

function renderRegionalStats(data) {
    if (!regionStats) return;
    regionStats.innerHTML = '';
    Object.entries(data).forEach(([name, counts]) => {
        const div = document.createElement('div');
        div.className = 'region-card';
        const total = counts.total || 1;
        div.innerHTML = `
            <span class="region-name">${name} Kerala (${counts.total} seats)</span>
            <div class="region-bar">
                <div style="width: ${(counts.LDF / total) * 100}%; background: var(--ldf-color);"></div>
                <div style="width: ${(counts.UDF / total) * 100}%; background: var(--udf-color);"></div>
                <div style="width: ${(counts.NDA / total) * 100}%; background: var(--nda-color);"></div>
            </div>
            <div class="region-labels"><span>LDF: ${counts.LDF}</span><span>UDF: ${counts.UDF}</span><span>NDA: ${counts.NDA}</span></div>
        `;
        regionStats.appendChild(div);
    });
}

function updateTicker() {
    if (!tickerContent) return;
    const significantLeads = electionData.filter(d => d.margin > 10000).slice(0, 3);
    const closeBattles = electionData.filter(d => d.margin < 500).slice(0, 3);
    let text = "BREAKING NEWS: ";
    significantLeads.forEach(d => text += ` 🔥 ${d.winner.name} leading in ${d.name} by ${d.margin.toLocaleString()} votes... `);
    closeBattles.forEach(d => text += ` ⚡ TIGHT CONTEST in ${d.name}: Margin ${d.margin.toLocaleString()}... `);
    tickerContent.textContent = text + text;
}

function renderKeyBattles(battles) {
    if (!keyBattlesList) return;
    keyBattlesList.innerHTML = '';
    battles.forEach(item => {
        const div = document.createElement('div');
        div.className = 'battle-item';
        div.onclick = () => openDetails(item.id);
        div.innerHTML = `<div class="battle-info"><span class="battle-const">${item.name}</span><span class="battle-candidates">${item.winner.name} vs ${item.runnerUp.name}</span></div><span class="battle-margin">${item.margin.toLocaleString()} votes</span>`;
        keyBattlesList.appendChild(div);
    });
}

function renderTable() {
    if (!resultsBody) return;
    const query = searchInput.value.toLowerCase();
    const displayData = electionData.filter(item => item.name.toLowerCase().includes(query) || item.district.toLowerCase().includes(query) || item.winner.party.toLowerCase().includes(query));
    resultsBody.innerHTML = '';
    displayData.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => openDetails(item.id);
        tr.innerHTML = `<td>${item.id}</td><td><div class="const-name">${item.name}</div><div class="dist-name" style="font-size: 0.7rem;">${item.district}</div></td><td>${item.winner.name}</td><td><span class="party-tag ${item.winner.alliance.toLowerCase()}">${item.winner.party}</span></td><td>${item.margin.toLocaleString()}</td><td><span class="status-tag">${item.status}</span></td>`;
        resultsBody.appendChild(tr);
    });
}

function openDetails(id) {
    const item = electionData.find(d => d.id === id);
    if (!item) return;
    document.getElementById('modalTitle').textContent = item.name;
    document.getElementById('modalSubtitle').textContent = item.district + " | " + item.region + " Kerala";
    document.getElementById('totalVoters').textContent = item.totalVoters.toLocaleString();
    document.getElementById('pollingPercentage').textContent = item.pollingPercent + '%';
    candidateList.innerHTML = '';
    const maxVotes = item.candidates[0].votes || 1;
    item.candidates.forEach(cand => {
        const row = document.createElement('div');
        row.className = 'candidate-row';
        row.innerHTML = `<div class="cand-info"><div><span class="cand-name">${cand.name}</span><span class="cand-party">${cand.party}</span></div><div class="cand-votes">${cand.votes.toLocaleString()}</div></div><div class="vote-bar-bg"><div class="vote-bar-fill ${cand.alliance.toLowerCase()}" style="width: ${(cand.votes / maxVotes) * 100}%; background-color: var(--${cand.alliance.toLowerCase()}-color, #6e7681)"></div></div>`;
        candidateList.appendChild(row);
    });
    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function filterByAlliance(alliance) {
    currentFilterAlliance = alliance;
    renderFilterModal();
    document.getElementById('filterModalOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function renderFilterModal() {
    if (!currentFilterAlliance) return;
    const query = (document.getElementById('filterSearchInput')?.value || '').toLowerCase().trim();

    const wins = electionData
        .filter(d => d.winner.alliance === currentFilterAlliance)
        .filter(d =>
            d.name.toLowerCase().includes(query) ||
            d.district.toLowerCase().includes(query) ||
            d.winner.name.toLowerCase().includes(query)
        )
        .sort((a, b) => b.margin - a.margin);

    document.getElementById('filterModalTitle').textContent = `${currentFilterAlliance} Leads`;
    document.getElementById('filterModalSubtitle').textContent = `Total Leads: ${wins.length}`;

    const body = document.getElementById('filterResultsBody');
    if (!body) return;
    body.innerHTML = '';

    if (wins.length === 0) {
        body.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem;">No results found in this alliance</td></tr>';
        return;
    }

    wins.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => { document.getElementById('filterModalOverlay').classList.add('hidden'); openDetails(item.id); };
        tr.innerHTML = `
            <td><div class="const-name">${item.name}</div><div class="dist-name" style="font-size: 0.7rem; color: #8b949e;">${item.district}</div></td>
            <td>${item.winner.name}</td>
            <td style="font-weight: 700; color: #3fb950;">+${item.margin.toLocaleString()}</td>
        `;
        body.appendChild(tr);
    });
}

function hideLoader() { if (loader) loader.classList.add('hidden'); }
function simulateData() {
    const districts = ['Kasaragod', 'Kannur', 'Wayanad', 'Kozhikode', 'Malappuram', 'Palakkad', 'Thrissur', 'Ernakulam', 'Idukki', 'Kottayam', 'Alappuzha', 'Pathanamthitta', 'Kollam', 'Thiruvananthapuram'];

    const realConstNames = [
        'Manjeshwar', 'Kasaragod', 'Udma', 'Kanhangad', 'Payyanur', 'Taliparamba', 'Irikkur', 'Azur', 'Kannur', 'Thalassery', 'Dharmadam',
        'Mananthavady', 'Sulthan Bathery', 'Kalpetta', 'Vadakara', 'Kuttiadi', 'Nadapuram', 'Quilandy', 'Perambra', 'Balussery', 'Kozhikode North', 'Kozhikode South',
        'Kondotty', 'Eranad', 'Nilambur', 'Wandoor', 'Manjeri', 'Perinthalmanna', 'Mankada', 'Malappuram', 'Vengara', 'Vallikkunnu', 'Tirurangadi', 'Tanur', 'Tirur', 'Kottakkal', 'Ponnani',
        'Thrithala', 'Pattambi', 'Shornur', 'Ottapalam', 'Kongad', 'Mannarkkad', 'Malampuzha', 'Palakkad', 'Chittur', 'Nenmara', 'Alathur',
        'Chelakkara', 'Kunnamkulam', 'Guruvayur', 'Manalur', 'Wadakkanchery', 'Ollur', 'Thrissur', 'Nattika', 'Kaipamangalam', 'Irinjalakuda', 'Puthukkad', 'Chalakudy', 'Kodungallur',
        'Perumbavoor', 'Angamaly', 'Aluva', 'Kalamassery', 'Paravur', 'Vypin', 'Kochi', 'Thrippunithura', 'Ernakulam', 'Thrikkakara', 'Kunnathunad', 'Piravom', 'Muvattupuzha', 'Kothamangalam',
        'Devikulam', 'Udumbanchola', 'Thodupuzha', 'Idukki', 'Peerumade', 'Pala', 'Kaduthuruthy', 'Vaikom', 'Ettumanoor', 'Kottayam', 'Puthuppally', 'Changanassery', 'Kanjirappally', 'Poonjar',
        'Aroor', 'Cherthala', 'Alappuzha', 'Ambalappuzha', 'Kuttanad', 'Haripad', 'Kayamkulam', 'Mavelikkara', 'Chengannur', 'Thiruvalla', 'Ranni', 'Aranmula', 'Konni', 'Adoor',
        'Karunagappally', 'Chavara', 'Kunnathur', 'Kottarakkara', 'Pathanapuram', 'Punalur', 'Chadayamangalam', 'Kundara', 'Kollam', 'Eravipuram', 'Chathannoor',
        'Varkala', 'Attingal', 'Chirayinkeezhu', 'Nedumangad', 'Vamanapuram', 'Kazhakkoottam', 'Vattiyoorkavu', 'Thiruvananthapuram', 'Nemom', 'Aruvikkara', 'Parassala', 'Kattakada', 'Neyyattinkara'
    ];

    const mockData = [];
    for (let i = 1; i <= 140; i++) {
        const alliance = ['LDF', 'UDF', 'NDA'][Math.floor(Math.random() * 3)];
        const dist = districts[Math.floor(Math.random() * districts.length)];
        const cName = realConstNames[i - 1] || `Constituency ${i}`;

        mockData.push({
            constituency: {
                constituency_Number: i,
                constituency_Name: cName,
                district: dist,
                'Voters Total': 200000,
                'Polling % (2026)': 75
            },
            candidates: [
                { name: `Candidate ${i} (L)`, alliance: alliance, party: 'Major Party', votes: 85000 },
                { name: `Candidate ${i} (R)`, alliance: 'others', party: 'Independent', votes: 84200 }
            ]
        });
    }
    processData(mockData);
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

if (searchInput) searchInput.addEventListener('input', debounce(() => renderTable()));
const filterSearchInput = document.getElementById('filterSearchInput');
if (filterSearchInput) filterSearchInput.addEventListener('input', () => renderFilterModal());

document.getElementById('closeModal').onclick = () => { modalOverlay.classList.add('hidden'); document.body.style.overflow = ''; };
document.getElementById('closeFilterModal').onclick = () => { document.getElementById('filterModalOverlay').classList.add('hidden'); document.body.style.overflow = ''; };

fetchData();
setInterval(fetchData, UPDATE_INTERVAL);
