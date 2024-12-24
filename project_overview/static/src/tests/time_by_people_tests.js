/** @odoo-module **/

import {getFixture, mount, patchWithCleanup} from "@web/../tests/helpers/utils";
import {actionService} from "@web/webclient/actions/action_service";
import {browser} from "@web/core/browser/browser";
import {TimeByPeople} from "../components/time_by_people/time_by_people";
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

QUnit.module("project_overview.TimeByPeople", {
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
            setTimeout: (handler, delay, ...args) => handler(...args),
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

QUnit.test("Should render Time By People component", async (assert) => {
    assert.expect(3);

    const env = await makeTestEnv(baseConfig);

    const mockProps = {
        projectId: "1",
        employeesData: [
            {
                employeeId: 20,
                name: "Abigail Peterson",
                invoiceDetails: [
                    {
                        invoiceType: "billable_time",
                        total: 28.5,
                    },
                    {
                        invoiceType: "non_billable",
                        total: 2,
                    },
                ],
                total: 30.5,
            },
            {
                employeeId: 3,
                name: "Anita Oliver",
                invoiceDetails: [
                    {
                        invoiceType: "billable_fixed",
                        total: 12,
                    },
                    {
                        invoiceType: "non_billable",
                        total: 1,
                    },
                ],
                total: 13,
            },
        ],
    };

    await mount(TimeByPeople, target, {env, props: mockProps});

    const timeByPeopleInstance = target.querySelector(".o_people_time");
    assert.ok(timeByPeopleInstance, "TimeByPeople component should be rendered");

    const maxTotal = new TimeByPeople(mockProps).maxTotal;
    assert.strictEqual(maxTotal, 30.5, "max total should be correct");

    const convertToHHMM = new TimeByPeople(mockProps).convertToHHMM(28.5);
    assert.strictEqual(convertToHHMM, "28:30", "convert to HHMM should be correct");
});
