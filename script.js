// Data is loaded from data.js and data_enrolments.js

// State
const selectedCourses = new Set();
let allCourses = [];

// DOM Elements
const coursesListEl = document.getElementById('courses-list');
const searchInput = document.getElementById('course-search');
const selectedCountEl = document.getElementById('selected-count');
const completedAreasListEl = document.getElementById('completed-areas-list');
const validCombinationsListEl = document.getElementById('valid-combinations-list');
const lastUpdatedEl = document.getElementById('last-updated');

// initialize curricular plan
const areasData = areasMEIC2026; // change curricular plan in data.js

function getCourseMetadata(acronym) {
    const metadata = courseMetadataByAcronym[acronym] || {};
    return {
        acronym,
        ...metadata,
        enrolments: getCourseEnrollments(acronym),
        limitLabel: metadata.limitLabel || 'n/a'
    };
}

function getCourseEnrollments(acronym) {
    if (!window.courseEnrolmentsByAcronym) {
        return null;
    }
    return window.courseEnrolmentsByAcronym[acronym] ?? null;
}

function updateLastUpdatedText() {
    if (!lastUpdatedEl) {
        return;
    }

    if (window.lastUpdatedTimestamp) {
        lastUpdatedEl.textContent = `Last update from Fenix at ${window.lastUpdatedTimestamp} (updated every hour)`;
    } else {
        lastUpdatedEl.textContent = 'Last update from Fenix not available yet.';
    }
}

// Initialize
function init() {
    const courseSet = new Set();
    Object.values(areasData).forEach(acronyms => {
        acronyms.forEach(acronym => {
            if (courseMetadataByAcronym[acronym]) {
                courseSet.add(acronym);
            }
        });
    });

    allCourses = Array.from(courseSet).sort((a, b) => {
        const aName = (courseMetadataByAcronym[a]?.name || a).toLowerCase();
        const bName = (courseMetadataByAcronym[b]?.name || b).toLowerCase();
        return aName.localeCompare(bName);
    });

    updateLastUpdatedText();
    renderCourses(allCourses);
    setupEventListeners();
    updateResults();
}

// Render Courses
function renderCourses(courses) {
    coursesListEl.innerHTML = '';
    courses.forEach(acronym => {
        const isSelected = selectedCourses.has(acronym);
        const metadata = getCourseMetadata(acronym);

        const label = document.createElement('label');
        label.className = `course-item`;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'course-checkbox';
        checkbox.checked = isSelected;
        checkbox.onchange = (e) => toggleCourse(acronym, e.target);

        const content = document.createElement('div');
        content.className = 'course-content';

        const title = document.createElement('span');
        title.className = 'course-name';
        title.textContent = `${metadata.acronym} - ${metadata.name}`;

        const meta = document.createElement('div');
        meta.className = 'course-meta';

        const details = document.createElement('span');
        details.className = 'course-details';

        const enrolmentsText = metadata.enrolments !== null && metadata.enrolments !== undefined
            ? `${metadata.enrolments}`
            : 'n/a';
        const limitText = metadata.limitLabel || 'n/a';

        const hasNumericLimit = metadata.limit !== null && metadata.limit !== undefined && Number.isFinite(metadata.limit) && metadata.limit > 0;
        const hasNumericEnrolments = metadata.enrolments !== null && metadata.enrolments !== undefined && Number.isFinite(metadata.enrolments);

        const detailsHtmlParts = [];
        let detailsHtml = '';

        const linkHref = metadata.fenixAcronym
            ? fenixCoursePageUrlTemplate
                .replace('{fenixAcronym}', metadata.fenixAcronym)
                .replace('{semester}', metadata.semester)
            : 'https://fenix.tecnico.ulisboa.pt/cursos/meic-a/curriculo';

        if (metadata.fenixAcronym || !hasNumericLimit || !hasNumericEnrolments) {
            const link = document.createElement('a');
            link.className = 'course-link';
            link.href = linkHref;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'course webpage';
            detailsHtml = link.outerHTML;
        }

        if (hasNumericLimit && hasNumericEnrolments) {
            const ratio = Math.min(1, Math.max(0, metadata.enrolments / metadata.limit));
            const barWidth = Math.max(8, Math.round(ratio * 70));
            const hue = 120 - (ratio * 120);
            const barColor = `hsl(${hue}, 70%, 50%)`;
            const textColor = ratio >= 0.95 ? '#7f1d1d' : ratio >= 0.8 ? '#92400e' : '#14532d';
            const enrolmentValue = `<span class="course-fullness" style="--bar-width:${barWidth}px; --bar-color:${barColor}; color:${textColor};" title="${metadata.enrolments}/${metadata.limit}"><span class="course-fullness__bar"></span><span class="course-fullness__value">${metadata.enrolments}</span></span>`;
            const enrolmentText = `Enrolments: ${enrolmentValue}`;

            if (detailsHtml) {
                detailsHtml += ` • ${enrolmentText}`;
            } else {
                detailsHtml = enrolmentText;
            }

            detailsHtml += ` • Limit: ${limitText}`;
        } else {
            const enrolmentText = `Enrolments: ${enrolmentsText}`;
            if (detailsHtml) {
                detailsHtml += ` • ${enrolmentText}`;
            } else {
                detailsHtml = enrolmentText;
            }

            detailsHtml += ` • Limit: ${limitText}`;
        }

        details.innerHTML = detailsHtml;
        meta.appendChild(details);

        content.appendChild(title);
        content.appendChild(meta);
        label.appendChild(checkbox);
        label.appendChild(content);
        coursesListEl.appendChild(label);
    });
}

const clearBtn = document.getElementById('clear-search');

// Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allCourses.filter(c => c.toLowerCase().includes(term));
        renderCourses(filtered);

        // Toggle clear button visibility
        clearBtn.style.display = term.length > 0 ? 'flex' : 'none';
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        renderCourses(allCourses);
        clearBtn.style.display = 'none';
        searchInput.focus();
    });
}

// Toggle Course Selection
function toggleCourse(acronym, checkbox) {
    if (checkbox.checked) {
        selectedCourses.add(acronym);
    } else {
        selectedCourses.delete(acronym);
    }

    const currentFilter = searchInput.value.toLowerCase();
    const filtered = allCourses.filter(course => {
        const metadata = getCourseMetadata(course);
        return metadata.name.toLowerCase().includes(currentFilter) || metadata.acronym.toLowerCase().includes(currentFilter);
    });
    renderCourses(filtered);

    updateResults();
}

// Update Results Logic
function updateResults() {
    selectedCountEl.textContent = `${selectedCourses.size}`;

    const completedAreas = [];
    for (const [area, acronyms] of Object.entries(areasData)) {
        const selectedInArea = acronyms.filter(acronym => selectedCourses.has(acronym));
        if (selectedInArea.length >= 4) {
            completedAreas.push({ name: area, count: selectedInArea.length, courses: selectedInArea });
        }
    }

    completedAreasListEl.innerHTML = '';
    if (completedAreas.length === 0) {
        completedAreasListEl.innerHTML = '<li class="empty-state">No areas completed yet</li>';
    } else {
        completedAreas.forEach(area => {
            const acronyms = area.courses.join(', ');
            const li = document.createElement('li');
            li.className = 'completed-area';
            li.textContent = `${area.name} (${acronyms})`;
            completedAreasListEl.appendChild(li);
        });
    }

    const validCombinations = [];
    for (let i = 0; i < completedAreas.length; i++) {
        for (let j = i + 1; j < completedAreas.length; j++) {
            const areaA = completedAreas[i];
            const areaB = completedAreas[j];

            const selectedInA = areaA.courses;
            const selectedInB = areaB.courses;
            const union = new Set([...selectedInA, ...selectedInB]);

            if (union.size >= 8) {
                const setA = new Set(selectedInA);
                const setB = new Set(selectedInB);

                const intersection = selectedInA.filter(c => setB.has(c));
                const uniqueA = selectedInA.filter(c => !setB.has(c));
                const uniqueB = selectedInB.filter(c => !setA.has(c));

                const neededA = Math.max(0, 4 - uniqueA.length);
                const neededB = Math.max(0, 4 - uniqueB.length);

                const finalA = [...uniqueA, ...intersection.slice(0, neededA)];
                const finalB = [...uniqueB, ...intersection.slice(neededA, neededA + neededB)];

                const remaining = intersection.slice(neededA + neededB);
                remaining.forEach(c => {
                    if (finalA.length <= finalB.length) {
                        finalA.push(c);
                    } else {
                        finalB.push(c);
                    }
                });

                finalA.sort();
                finalB.sort();

                const acronymsA = finalA.join(', ');
                const acronymsB = finalB.join(', ');
                validCombinations.push(`${areaA.name} (${acronymsA}) + ${areaB.name} (${acronymsB})`);
            }
        }
    }

    validCombinationsListEl.innerHTML = '';
    if (validCombinations.length === 0) {
        validCombinationsListEl.innerHTML = '<li class="empty-state">Select more courses to see combinations</li>';
    } else {
        validCombinations.forEach(combo => {
            const li = document.createElement('li');
            li.className = 'valid-combination';
            li.textContent = combo;
            validCombinationsListEl.appendChild(li);
        });
    }
}

// Start
init();
