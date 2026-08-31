# MEIC-areas

This repository helps MEIC students:

- explore specialization areas, select courses, and check whether their choices form valid combinations
- show current enrolment information from Fénix for the relevant courses.

This is a non-official project maintained by [Pedro T. Monteiro](https://github.com/ptgm).

## Features

- Interactive course selection for MEIC specialization areas
- Visual validation of completed areas and valid area combinations
- Course webpage links and enrolment/limit information
- Automatic refresh of enrolment data from Fénix
- Published to GitHub Pages at https://ptgm.github.io/MEIC-areas/

## Project structure

- index.html: main page
- style.css: layout and styling
- script.js: UI logic and results calculation
- data.js: course metadata and curricular-plan mappings
- check_meic_enrolments.py: fetches enrolment data from Fénix and writes generated JavaScript files
- data_enrolments.js: generated enrolment data used by the page
- data_last_updated.js: generated timestamp used for the “last updated” message
- .github/workflows/deploy.yml: GitHub Actions workflow for Pages deployment and hourly refreshes

## Deployment and updates

The site is published to GitHub Pages through GitHub Actions.

The workflow runs:
- on every push to the main branch
- manually via the Actions tab
- every hour with a cron schedule

If you want to contribute, feel free to fork the repository, make improvements, and open a pull request.
