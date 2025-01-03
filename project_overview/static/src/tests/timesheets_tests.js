/** @odoo-module **/

import {getFixture, mount, patchWithCleanup} from "@web/../tests/helpers/utils";
import {actionService} from "@web/webclient/actions/action_service";
import {browser} from "@web/core/browser/browser";
import {Timesheets} from "../components/timesheets/timesheets";
import {hotkeyService} from "@web/core/hotkeys/hotkey_service";
import {makeTestEnv} from "@web/../tests/helpers/mock_env";
import {menuService} from "@web/webclient/menus/menu_service";
import {notificationService} from "@web/core/notifications/notification_service";
import {ormService} from "@web/core/orm_service";
import {registry} from "@web/core/registry";
import {uiService} from "@web/core/ui/ui_service";
import {viewService} from "@web/views/view_service";

const serviceRegistry = registry.category("services");
const {QUnit} = window;

let baseConfig = null;
let target = null;

QUnit.module("project_overview.Timesheets", {
    async beforeEach() {
        target = getFixture();
        serviceRegistry.add("menu", menuService);
        serviceRegistry.add("action", actionService);
        serviceRegistry.add("notification", notificationService);
        serviceRegistry.add("hotkey", hotkeyService);
        serviceRegistry.add("ui", uiService);
        serviceRegistry.add("view", viewService);
        serviceRegistry.add("orm", ormService);

        patchWithCleanup(browser, {
            setTimeout: (handler, ...args) => handler(...args),
            // eslint-disable-next-line no-empty-function
            clearTimeout: () => {},
        });

        const menus = {
            root: {id: "root", children: [1], name: "root", appID: "root"},
            1: {id: 1, children: [], name: "App0", appID: 1},
        };

        const serverData = {menus};
        baseConfig = {serverData};
    },
});

QUnit.test("Should render Timesheets component", async (assert) => {
    assert.expect(4);

    const env = await makeTestEnv(baseConfig);

    const mockProps = {
        projectId: "1",
        record: {
            data: {
                timesheets_field: {
                    columns: [
                        {id: "name", name: "Nom"},
                        {id: "before", name: "Avant"},
                        {id: "oct.", name: "oct."},
                        {id: "nov.", name: "nov."},
                        {id: "dec.", name: "dec."},
                        {id: "done", name: "Terminé"},
                        {id: "sold", name: "Vendu"},
                        {id: "remaining", name: "Restant"},
                    ],
                    content: [
                        {
                            before: 6.0,
                            "dec.": 3.0,
                            done: 9.0,
                            id: 23,
                            name: "S00023",
                            "nov.": 0.0,
                            "oct.": 0.0,
                            remaining: 1.0,
                            sale_lines: [
                                {
                                    before: 6.0,
                                    "dec.": 3.0,
                                    done: 9.0,
                                    id: 58,
                                    name: "Customer Care (Prepaid Hours)",
                                    "nov.": 0.0,
                                    "oct.": 0.0,
                                    remaining: 1.0,
                                    employees: [
                                        {
                                            before: 6.0,
                                            "dec.": 0.0,
                                            done: 6.0,
                                            name: "TOURLONIAS Bertrand",
                                            "nov.": 0.0,
                                            "oct.": 0.0,
                                            remaining: 0,
                                            sold: 0,
                                        },
                                        {
                                            before: 0.0,
                                            "dec.": 3.0,
                                            done: 3.0,
                                            name: "MICHEL Jean",
                                            "nov.": 0.0,
                                            "oct.": 0.0,
                                            remaining: 0,
                                            sold: 0,
                                        },
                                    ],
                                    sold: 10.0,
                                },
                            ],
                            sold: 10.0,
                        },
                    ],
                },
            },
        },
    };

    await mount(Timesheets, target, {env, props: mockProps});

    const timesheetsInstance = target.querySelector(".o_project_overview_timesheets");
    assert.ok(timesheetsInstance, "Timesheets component should be rendered");

    const pageTextContent = target.textContent;

    assert.ok(
        pageTextContent.includes("TOURLONIAS Bertrand"),
        "The employee name 'TOURLONIAS Bertrand' should be present in the page"
    );
    assert.ok(
        pageTextContent.includes("MICHEL Jean"),
        "The employee name 'MICHEL Jean' should be present in the page"
    );
    assert.ok(
        pageTextContent.includes("Customer Care (Prepaid Hours)"),
        "The employee name 'Customer Care (Prepaid Hours)' should be present in the page"
    );
});
