# Copyright OpenStudio 2024
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).
{
    "name": "Project overview",
    "category": "web",
    "version": "16.0.1.0.0",
    "website": "https://github.com/OCA/project",
    "author": "OpenStudio, Elise Gigot, Simon Maillard, Odoo Community Association (OCA)",
    "depends": [
        "project",
        "web",
        "sale_timesheet",
    ],
    "external_dependencies": {"python": ["polars"]},
    "summary": "Add project overview page",
    "license": "AGPL-3",
    "data": [
        "views/project_kanban_view.xml",
        "views/project_overview_view.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "project_overview/static/src/scss/project_overview.scss",
            "project_overview/static/src/js/register.js",
            "project_overview/static/src/components/**/*",
            "project_overview/static/src/js/custom_form_controller.js",
            "project_overview/static/src/js/custom_form_control_panel.js",
            "project_overview/static/src/xml/custom_form_panel.xml",
        ],
        "web.qunit_suite_tests": [
            "project_overview/static/src/tests/dashboard_tests.js",
            "project_overview/static/src/tests/global_actions_tests.js",
            "project_overview/static/src/tests/time_by_people_tests.js",
            "project_overview/static/src/tests/timesheets_tests.js",
        ],
    },
    "installable": True,
}
