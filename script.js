// Data is loaded from data.js and data_enrolments.js

// State
const selectedCourses = new Set();
const selectedOptionalCourses = new Set();
let allCourses = [];
let selectedValidCombinationKey = null;

const mandatoryCourses = [
    { acronym: 'PIC2', name: 'PIC2', ects: 12, autoSelected: true },
    { acronym: 'Dissertation', name: 'Dissertation', ects: 30, autoSelected: true }
];
const optionalCourseRows = [
    { acronym: 'AE I', name: 'Extracurricular activities I', ects: 3, autoSelected: false },
    { acronym: 'AE II', name: 'Extracurricular activities II', ects: 3, autoSelected: false }
];
const MAX_TOTAL_ECTS = 126;

// DOM Elements
const coursesListEl = document.getElementById('courses-list');
const mandatoryCoursesEl = document.getElementById('mandatory-courses');
const searchInput = document.getElementById('course-search');
const periodFilterButtons = Array.from(document.querySelectorAll('.period-filter-tag'));
const selectedCountEl = document.getElementById('selected-count');
const completedAreasListEl = document.getElementById('completed-areas-list');
const validCombinationsListEl = document.getElementById('valid-combinations-list');
const electivesListEl = document.getElementById('electives-list');
const lastUpdatedEl = document.getElementById('last-updated');
const selectedPeriods = new Set();

// initialize curricular plan
const areasData = areasMEIC2026; // change curricular plan in data.js

function getCourseMetadata(acronym) {
    const optionalRow = optionalCourseRows.find(course => course.acronym === acronym);
    if (optionalRow) {
        return {
            acronym,
            ...optionalRow,
            ects: Number(optionalRow.ects ?? 3),
            enrolments: null,
            limitText: 'n/a'
        };
    }

    const metadata = courseMetadataByAcronym[acronym] || {};
    return {
        acronym,
        ...metadata,
        ects: Number(metadata.ects ?? 6),
        enrolments: getCourseEnrollments(acronym),
        limitText: metadata.limit === null || metadata.limit === undefined ? 'n/a' : String(metadata.limit)
    };
}

function getCourseEnrollments(acronym) {
    if (!window.courseEnrolmentsByAcronym) {
        return null;
    }
    return window.courseEnrolmentsByAcronym[acronym] ?? null;
}

function isMandatoryCourse(acronym) {
    return mandatoryCourses.some(course => course.acronym === acronym);
}

function isOptionalCourseRow(acronym) {
    return optionalCourseRows.some(course => course.acronym === acronym);
}

function getDisplayMetadata(acronym) {
    if (isMandatoryCourse(acronym)) {
        const mandatoryCourse = mandatoryCourses.find(course => course.acronym === acronym);
        return {
            acronym,
            name: mandatoryCourse?.name || acronym,
            ects: mandatoryCourse?.ects || 0,
            enrolments: null,
            limitText: 'n/a',
            isMandatory: true
        };
    }

    if (isOptionalCourseRow(acronym)) {
        const optionalCourse = optionalCourseRows.find(course => course.acronym === acronym);
        return {
            acronym,
            name: optionalCourse?.name || acronym,
            ects: optionalCourse?.ects || 0,
            enrolments: null,
            limitText: 'n/a',
            isMandatory: false,
            isOptionalRow: true
        };
    }

    return getCourseMetadata(acronym);
}

function getCoursePeriodMatches(periodValue) {
    const normalizedValue = String(periodValue || '').trim();
    if (normalizedValue === 'P1+P2') {
        return new Set(['P1', 'P2']);
    }
    if (normalizedValue === 'P3+P4') {
        return new Set(['P3', 'P4']);
    }
    return new Set(normalizedValue ? [normalizedValue] : []);
}

function courseMatchesSelectedPeriods(periodValue) {
    if (selectedPeriods.size === 0) {
        return true;
    }

    const coursePeriodMatches = getCoursePeriodMatches(periodValue);
    for (const selectedPeriod of selectedPeriods) {
        if (coursePeriodMatches.has(selectedPeriod)) {
            return true;
        }
    }
    return false;
}

function getFilteredCourses() {
    const currentFilter = searchInput.value.toLowerCase();
    return allCourses.filter(course => {
        const metadata = getCourseMetadata(course);
        const textMatches = !currentFilter || metadata.acronym.toLowerCase().includes(currentFilter) || metadata.name.toLowerCase().includes(currentFilter);
        const periodMatches = courseMatchesSelectedPeriods(metadata.period);
        return textMatches && periodMatches;
    });
}

function updateLastUpdatedText() {
    if (!lastUpdatedEl) {
        return;
    }

    if (window.lastUpdatedTimestamp) {
        lastUpdatedEl.textContent = `Enrolments last update from Fenix-API at ${window.lastUpdatedTimestamp} (updated every hour)`;
    } else {
        lastUpdatedEl.textContent = 'Enrolments last update from Fenix-API not available yet.';
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

    mandatoryCourses.forEach(course => {
        if (course.autoSelected) {
            selectedCourses.add(course.acronym);
        }
    });

    optionalCourseRows.forEach(course => {
        selectedCourses.add(course.acronym);
        // intentionally left unselected by default; only added to selectedCourses for rendering state
    });

    allCourses = Array.from(courseSet).sort((a, b) => {
        const aName = (courseMetadataByAcronym[a]?.name || a).toLowerCase();
        const bName = (courseMetadataByAcronym[b]?.name || b).toLowerCase();
        return aName.localeCompare(bName);
    });

    updateLastUpdatedText();
    renderMandatoryCourses();
    renderCourses(allCourses);
    setupEventListeners();
    updateResults();
    searchInput.focus();
}

function getTotalEcts() {
    const selectedOptionalEcts = Array.from(selectedOptionalCourses).reduce((sum, acronym) => {
        const metadata = getCourseMetadata(acronym);
        const courseEcts = Number(metadata.ects ?? 6);
        return sum + (Number.isFinite(courseEcts) ? courseEcts : 0);
    }, 0);

    return 42 + selectedOptionalEcts;
}

function shouldDisableCourseSelection(acronym, isSelected) {
    if (isSelected) {
        return false;
    }
    return getTotalEcts() >= MAX_TOTAL_ECTS;
}

function renderMandatoryCourses() {
    if (!mandatoryCoursesEl) {
        return;
    }

    mandatoryCoursesEl.innerHTML = '';

    [...optionalCourseRows, ...mandatoryCourses].forEach(course => {
        const label = document.createElement('label');
        label.className = 'course-item mandatory-course-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'course-checkbox';
        const currentlySelected = course.autoSelected || selectedOptionalCourses.has(course.acronym);
        checkbox.checked = currentlySelected;
        checkbox.disabled = course.autoSelected || shouldDisableCourseSelection(course.acronym, currentlySelected);
        checkbox.onchange = (e) => {
            if (course.autoSelected) {
                return;
            }
            if (e.target.checked) {
                selectedOptionalCourses.add(course.acronym);
                selectedCourses.add(course.acronym);
            } else {
                selectedOptionalCourses.delete(course.acronym);
                selectedCourses.delete(course.acronym);
            }
            renderMandatoryCourses();
            renderCourses(getFilteredCourses());
            updateResults();
            searchInput.focus();
        };

        const content = document.createElement('div');
        content.className = 'course-content';

        const title = document.createElement('span');
        title.className = 'course-name';
        title.textContent = `${course.acronym} - ${course.name}`;

        const ectsBadge = document.createElement('span');
        ectsBadge.className = 'course-ects-inline';
        ectsBadge.textContent = `(${course.ects} ECTS)`;

        title.appendChild(ectsBadge);

        const meta = document.createElement('div');
        meta.className = 'course-meta';
        meta.style.display = 'none';

        content.appendChild(title);
        content.appendChild(meta);
        label.appendChild(checkbox);
        label.appendChild(content);
        mandatoryCoursesEl.appendChild(label);
    });

    const totalLine = document.createElement('div');
    totalLine.className = 'mandatory-total';
    totalLine.textContent = `Total ECTS: ${getTotalEcts()}`;
    mandatoryCoursesEl.appendChild(totalLine);
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
        checkbox.disabled = !isSelected && shouldDisableCourseSelection(acronym, isSelected);
        checkbox.onchange = (e) => toggleCourse(acronym, e.target);

        const content = document.createElement('div');
        content.className = 'course-content';

        const titleRow = document.createElement('div');
        titleRow.className = 'course-title-row';

        const title = document.createElement('span');
        title.className = 'course-name';
        title.textContent = `${metadata.acronym} - ${metadata.name}`;

        const periodTag = document.createElement('span');
        periodTag.className = 'course-period-tag';
        periodTag.dataset.period = metadata.period || 'n/a';
        periodTag.textContent = metadata.period || 'n/a';
        periodTag.title = `Period ${metadata.period || 'n/a'}`;

        titleRow.appendChild(title);
        titleRow.appendChild(periodTag);

        const meta = document.createElement('div');
        meta.className = 'course-meta';

        const details = document.createElement('span');
        details.className = 'course-details';

        const enrolmentsText = metadata.enrolments !== null && metadata.enrolments !== undefined
            ? `${metadata.enrolments}`
            : 'n/a';
        const limitText = metadata.limitText || (metadata.limit === null || metadata.limit === undefined ? 'n/a' : String(metadata.limit));

        const hasNumericLimit = metadata.limit !== null && metadata.limit !== undefined && Number.isFinite(metadata.limit) && metadata.limit > 0;
        const hasNumericEnrolments = metadata.enrolments !== null && metadata.enrolments !== undefined && Number.isFinite(metadata.enrolments);

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

        content.appendChild(titleRow);
        content.appendChild(meta);
        label.appendChild(checkbox);
        label.appendChild(content);
        coursesListEl.appendChild(label);
    });
}

const clearBtn = document.getElementById('clear-search');

function updatePeriodFilterButtons() {
    periodFilterButtons.forEach(button => {
        const isActive = selectedPeriods.has(button.dataset.period);
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
}

// Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();
        const filtered = getFilteredCourses();
        renderCourses(filtered);

        // Toggle clear button visibility
        clearBtn.style.display = term.length > 0 ? 'flex' : 'none';
    });

    periodFilterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const period = button.dataset.period;
            if (selectedPeriods.has(period)) {
                selectedPeriods.delete(period);
            } else {
                selectedPeriods.add(period);
            }
            updatePeriodFilterButtons();
            renderCourses(getFilteredCourses());
        });
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        selectedPeriods.clear();
        updatePeriodFilterButtons();
        renderCourses(getFilteredCourses());
        clearBtn.style.display = 'none';
        searchInput.focus();
    });
}

// Toggle Course Selection
function toggleCourse(acronym, checkbox) {
    if (isMandatoryCourse(acronym)) {
        return;
    }

    if (isOptionalCourseRow(acronym)) {
        if (checkbox.checked) {
            selectedOptionalCourses.add(acronym);
            selectedCourses.add(acronym);
        } else {
            selectedOptionalCourses.delete(acronym);
            selectedCourses.delete(acronym);
        }
        renderMandatoryCourses();
        renderCourses(getFilteredCourses());
        updateResults();
        searchInput.focus();
        return;
    }

    if (checkbox.checked) {
        selectedOptionalCourses.add(acronym);
        selectedCourses.add(acronym);
    } else {
        selectedOptionalCourses.delete(acronym);
        selectedCourses.delete(acronym);
    }

    renderMandatoryCourses();
    renderCourses(getFilteredCourses());

    updateResults();
    searchInput.focus();
}

function getCourseCombinations(courses, size) {
    const combinations = [];

    function buildCombination(startIndex, combination) {
        if (combination.length === size) {
            combinations.push(combination);
            return;
        }

        for (let index = startIndex; index <= courses.length - (size - combination.length); index++) {
            buildCombination(index + 1, [...combination, courses[index]]);
        }
    }

    buildCombination(0, []);
    return combinations;
}

// Update Results Logic
function updateResults() {
    selectedCountEl.textContent = `${selectedOptionalCourses.size}`;

    const completedAreas = [];
    for (const [area, acronyms] of Object.entries(areasData)) {
        const selectedInArea = acronyms.filter(acronym => selectedOptionalCourses.has(acronym));
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

            const assignmentsA = getCourseCombinations(areaA.courses, 4);
            const assignmentsB = getCourseCombinations(areaB.courses, 4);

            assignmentsA.forEach(assignmentA => {
                assignmentsB.forEach(assignmentB => {
                    const courseSet = new Set([...assignmentA, ...assignmentB]);
                    if (courseSet.size !== 8) {
                        return;
                    }

                    const sortedAssignmentA = [...assignmentA].sort();
                    const sortedAssignmentB = [...assignmentB].sort();
                    const acronymsA = sortedAssignmentA.join(', ');
                    const acronymsB = sortedAssignmentB.join(', ');
                    const key = `${areaA.name}:${acronymsA}::${areaB.name}:${acronymsB}`;
                    validCombinations.push({
                        key,
                        text: `${areaA.name} (${acronymsA}) + ${areaB.name} (${acronymsB})`,
                        courseSet,
                        unionSize: courseSet.size,
                    });
                });
            });
        }
    }

    validCombinations.sort((a, b) => b.unionSize - a.unionSize || a.text.localeCompare(b.text));

    if (!validCombinations.some(combo => combo.key === selectedValidCombinationKey)) {
        selectedValidCombinationKey = validCombinations[0]?.key ?? null;
    }

    const chosenCombination = validCombinations.find(combo => combo.key === selectedValidCombinationKey) || validCombinations[0] || null;
    const chosenSpecializationCourses = chosenCombination ? chosenCombination.courseSet : new Set();

    const completedAreaCourses = new Set(completedAreas.flatMap(area => area.courses));
    let electives = [];

    if (chosenCombination) {
        electives = Array.from(selectedOptionalCourses).filter(acronym => !chosenSpecializationCourses.has(acronym));
    } else if (completedAreas.length > 0) {
        electives = Array.from(selectedOptionalCourses).filter(acronym => !completedAreaCourses.has(acronym));
    } else {
        electives = Array.from(selectedOptionalCourses);
    }

    const subtitleText = 'Pairs of areas with 8 distinct courses total;';

    const subtitleEl = document.getElementById('valid-combinations-subtitle');
    if (subtitleEl) {
        subtitleEl.textContent = subtitleText;
    }

    electivesListEl.innerHTML = '';
    if (electives.length === 0) {
        electivesListEl.innerHTML = '<li class="empty-state">No electives selected yet</li>';
    } else {
        const li = document.createElement('li');
        li.className = 'elective-course';
        li.textContent = electives.join(', ');
        electivesListEl.appendChild(li);
    }

    validCombinationsListEl.innerHTML = '';
    if (validCombinations.length === 0) {
        validCombinationsListEl.innerHTML = '<li class="empty-state">Select more courses to see combinations</li>';
    } else {
        validCombinations.forEach(combo => {
            const li = document.createElement('li');
            li.className = 'valid-combination';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'valid-combination-checkbox';
            checkbox.checked = combo.key === selectedValidCombinationKey;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedValidCombinationKey = combo.key;
                } else if (selectedValidCombinationKey === combo.key) {
                    selectedValidCombinationKey = null;
                }
                updateResults();
            });

            const label = document.createElement('label');
            label.className = 'valid-combination-label';
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${combo.text}`));
            li.appendChild(label);
            validCombinationsListEl.appendChild(li);
        });
    }
}

// Start
init();
