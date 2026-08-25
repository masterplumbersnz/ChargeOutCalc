(function () {
    // Capture the pristine page markup before any dynamic rendering happens,
    // so the "Save my data" feature can produce a fresh, working copy of this
    // file with the person's own data pre-loaded into it.
    var PRISTINE_HTML = document.documentElement.outerHTML;

    // KiwiSaver's minimum compulsory employer contribution rises from 3.5% to 4%
    // on 1 April 2028 (Inland Revenue). Rather than hard-coding a rate that goes
    // stale, work out which one currently applies from the browser's own clock.
    function currentKiwiSaverRate() {
        var now = new Date();
        var reached2028Increase = now.getFullYear() > 2028 || (now.getFullYear() === 2028 && now.getMonth() >= 3);
        return reached2028Increase ? 0.04 : 0.035;
    }
    var KIWISAVER_RATE = currentKiwiSaverRate();
    var KIWISAVER_SOURCE_NOTE = KIWISAVER_RATE === 0.04
        ? "Minimum compulsory employer contribution, automatically updated to 4% now that the scheduled 1 April 2028 increase has taken effect."
        : "Minimum compulsory employer contribution, effective 1 April 2026 for employees on the default/minimum rate. Scheduled to rise to 4% from 1 April 2028 - this calculator will switch to that rate automatically once the date is reached.";

    const defaultAssumptions = {
        hoursPerWeek: { value: 40, label: "Ordinary hours per week", source: "Standard full-time working week, used as the basis for annualising wages and leave. Adjust if your team works different hours.", link: "https://www.employment.govt.nz/pay-and-hours/hours-and-breaks/hours-of-work", linkLabel: "Employment NZ - hours of work" },
        weeksPaidPerYear: { value: 52, label: "Weeks paid per year", source: "Fixed: there are 52 weeks in a year. Not independently sourced - it's a calendar fact used to annualise the hourly wage." },
        annualLeaveWeeks: { value: 4, label: "Annual leave entitlement (weeks/year)", source: "Holidays Act 2003 statutory minimum, available after 12 months' continuous employment.", link: "https://www.employment.govt.nz/leave-and-holidays/annual-holidays", linkLabel: "Employment NZ - annual holidays" },
        publicHolidayDays: { value: 12, label: "Public holidays (days/year)", source: "11 national public holidays (incl. Matariki) plus 1 regional anniversary day - the number most employees get.", link: "https://www.employment.govt.nz/leave-and-holidays/public-holidays/public-holidays-and-anniversary-dates", linkLabel: "Employment NZ - public holidays" },
        sickLeaveDays: { value: 10, label: "Sick leave assumed taken (days/employee/year)", source: "Starts at 10 days, matching the statutory annual entitlement after eligibility. For pricing, this field represents the paid sick leave you expect to be taken and therefore unavailable for billable work - replace it with your own experience if appropriate.", link: "https://www.employment.govt.nz/leave-and-holidays/sick-leave", linkLabel: "Employment NZ - sick leave" },
        nonBillablePct: { value: 0.2, label: "Default non-billable time at work (%)", source: "Starting estimate for paid time that cannot be charged to customers: travel, training, admin, quoting, toolbox meetings, stock collection, callbacks/rework, supervision, paid breaks and downtime. Not a statutory figure. If you bill travel time separately, remove that billed time from this percentage.", isPct: true },
        accWorkLevy: { value: 0.0135, label: "ACC Work Levy (%)", source: "Employer Work Account levy rate for Classification Unit 42310 'Plumbing services' (Levy Risk Group 323), confirmed from ACC's official Levy Guidebook 2026/27 (page 77: $1.35 per $100, EMP/SEP rate). This is the standard rate before any Experience Rating discount/loading your business may carry. Confirm the exact rate on your latest ACC invoice or in MyACC for Business.", isPct: true, decimals: 2, link: "https://www.acc.co.nz/assets/business/Levy-Guidebook-2026-2027.pdf", linkLabel: "ACC Levy Guidebook 2026/27 (PDF)" },
        accSaferLevy: { value: 0.0008, label: "ACC Working Safer Levy (%)", source: "Flat employer levy collected on behalf of WorkSafe New Zealand, confirmed at $0.08 per $100 of liable earnings in ACC's Levy Guidebook 2026/27 (page 9).", isPct: true, decimals: 2, link: "https://www.acc.co.nz/assets/business/Levy-Guidebook-2026-2027.pdf", linkLabel: "ACC Levy Guidebook 2026/27 (PDF)" },
        accMaxLiableEarnings: { value: 156641, label: "ACC maximum liable earnings ($/year)", source: "ACC Work Levy and Working Safer Levy are charged only up to this amount of earnings per employee, 2026/27 levy year (1 April 2026 - 31 March 2027).", link: "https://www.acc.co.nz/for-business/understanding-levies-if-you-work-or-own-a-business", linkLabel: "ACC - understanding levies" },
        kiwiSaverPct: { value: KIWISAVER_RATE, label: "KiwiSaver employer contribution (%)", source: KIWISAVER_SOURCE_NOTE, isPct: true, decimals: 2, link: "https://www.ird.govt.nz/kiwisaver/kiwisaver-employers/contributions-and-deductions/employer-contributions-to-kiwisaver-and-complying-funds", linkLabel: "Inland Revenue - employer contributions" },
        gstRate: { value: 0.15, label: "GST rate (%)", source: "New Zealand standard GST rate, used only to show the incl.-GST charge-out figure.", isPct: true, link: "https://www.ird.govt.nz/gst", linkLabel: "Inland Revenue - GST" },
        vehicleAppLab: { value: 1500, label: "Default vehicle cost allocation, Apprentice/Labourer ($/year, excl. GST)", source: "Starting estimate for vehicle cost only where an apprentice or labourer shares transport rather than operating a dedicated vehicle. Do not include tools here - they have their own field. Replace this allocation with your own number.", link: "https://www.ird.govt.nz/vehicle-expenses", linkLabel: "Inland Revenue - vehicle expenses" },
        vehicleTradeCert: { value: 13000, label: "Default vehicle cost, Tradesperson/Certifier ($/year, excl. GST)", source: "Starting estimate for a dedicated work vehicle only. Replace it with your own annual vehicle cost and do not include tools here - tools have their own field. Include the vehicle ownership/lease cost using the accounting approach your business actually uses, without double-counting depreciation and finance/lease costs.", link: "https://www.ird.govt.nz/vehicle-expenses", linkLabel: "Inland Revenue - vehicle expenses" },
        defaultTools: { value: 0, label: "Default tools & equipment ($/year, excl. GST)", source: "No separate default has been assumed - not sourced from an external benchmark. Enter the annual tools/equipment portion that should remain in the labour rate, especially if vehicle costs are recovered separately." },
        defaultOverheads: { value: 8000, label: "Default share of overheads, all roles ($/year, excl. GST)", source: "Starting estimate only - not sourced from an external benchmark. Use total annual overheads excluding vehicle/tools already counted, divided by billable staff." },
        gasfittingLoading: { value: 0, label: "Optional gasfitting uplift on final target rate (%)", source: "Business-specific commercial input - not sourced from an external benchmark. No default is recommended. If entered, it is applied after the normal target-margin calculation to Gasfitting rows only, so a 5% uplift increases the calculated target rate by 5%.", isPct: true }
    };

    const TRADE_OPTIONS = ["Plumbing", "Gasfitting", "Drainlaying"];

    // ---------- Role type metadata (drives multi-person-per-role support) ----------
    const roleTypeMeta = {
        apprentice: { baseLabel: "Apprentice", vehicleKey: "vehicleAppLab", hasYear: true, hasTrade: false },
        labourer: { baseLabel: "Labourer / Trades Assistant", vehicleKey: "vehicleAppLab", hasYear: false, hasTrade: false },
        tradesperson: { baseLabel: "Tradesperson", vehicleKey: "vehicleTradeCert", hasYear: false, hasTrade: true },
        certifier: { baseLabel: "Certifier", vehicleKey: "vehicleTradeCert", hasYear: false, hasTrade: true }
    };
    const roleTypeOrder = ["apprentice", "labourer", "tradesperson", "certifier"];

    let A = JSON.parse(JSON.stringify(defaultAssumptions));
    let vehicleRecoveryMode = "included";
    let instanceSeq = 0;
    let roleDefs = [];
    let roleState = {};
    let groupMode = {};
    let suppressNextAutoSelect = false;

    const rolesEl = document.getElementById("mpc-roles");
    const summaryEl = document.getElementById("mpc-summary");
    const assumptionListEl = document.getElementById("mpc-assumption-list");

    document.addEventListener("focusin", function (e) {
        if (e.target && e.target.tagName === "INPUT" && e.target.hasAttribute("inputmode")) {
            if (suppressNextAutoSelect) { suppressNextAutoSelect = false; return; }
            e.target.select();
        }
    });

    document.addEventListener("click", function (e) {
        if (e.target.closest(".mpc-overhead-popup-anchor") || e.target.closest(".mpc-vehicle-popup-anchor")) return;
        let anyOpen = false;
        Object.keys(roleState).forEach(function (key) {
            if (roleState[key].overheadPopupOpen) { roleState[key].overheadPopupOpen = false; anyOpen = true; }
            if (roleState[key].vehiclePopupOpen) { roleState[key].vehiclePopupOpen = false; anyOpen = true; }
        });
        if (anyOpen) renderRoles();
    });

    function parseUserNumber(raw) {
        if (raw === null || raw === undefined) return null;
        const cleaned = String(raw).trim().replace(/[$\s]/g, "").replace(/,/g, "");
        if (cleaned === "" || cleaned === "." || cleaned === "-" || cleaned === "-.") return null;
        const n = Number(cleaned);
        return Number.isFinite(n) ? n : null;
    }

    function editableNumber(n, maxDecimals) {
        maxDecimals = maxDecimals === undefined ? 4 : maxDecimals;
        if (n === null || n === undefined || !Number.isFinite(Number(n))) return "";
        return Number(n).toLocaleString("en-NZ", { useGrouping: false, maximumFractionDigits: maxDecimals });
    }

    function editableGroupedNumber(n, maxDecimals) {
        maxDecimals = maxDecimals === undefined ? 4 : maxDecimals;
        if (n === null || n === undefined || !Number.isFinite(Number(n))) return "";
        return Number(n).toLocaleString("en-NZ", { useGrouping: true, maximumFractionDigits: maxDecimals });
    }

    function editablePct(fraction) { return editableNumber(Number(fraction) * 100, 4); }
    function editableFixedPct(fraction, decimals) {
        if (fraction === null || fraction === undefined || !Number.isFinite(Number(fraction))) return "";
        return (Number(fraction) * 100).toFixed(decimals);
    }
    function fmtMoney(n) { return n === null || n === undefined || isNaN(n) ? "-" : "$" + Number(n).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function fmtMoneyWhole(n) { return n === null || n === undefined || isNaN(n) ? "-" : "$" + Math.round(Number(n)).toLocaleString("en-NZ"); }
    function fmtHours(n) { return Number(n).toLocaleString("en-NZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
    function fmtSignedMoney(n) {
        if (n === null || n === undefined || isNaN(n)) return "-";
        const sign = n > 0 ? "+" : n < 0 ? "-" : "";
        return sign + "$" + Math.abs(Number(n)).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtSignedMoneyWhole(n) {
        if (n === null || n === undefined || isNaN(n)) return "-";
        const sign = n > 0 ? "+" : n < 0 ? "-" : "";
        return sign + "$" + Math.round(Math.abs(Number(n))).toLocaleString("en-NZ");
    }
    function signClass(n) { return n > 0 ? "mpc-positive" : n < 0 ? "mpc-negative" : ""; }
    function comparisonRowHtml(label, word, hourVal, yearVal, isOpportunityRow) {
        const labelHtml = word ? label + '<br>Estimated labour <strong>' + word + '</strong>' : label;
        const hourText = isOpportunityRow ? fmtMoney(hourVal) : fmtSignedMoney(hourVal);
        const yearText = isOpportunityRow ? fmtMoneyWhole(yearVal) : fmtSignedMoneyWhole(yearVal);
        const rowClass = isOpportunityRow ? ' class="mpc-comparison-row-opportunity"' : '';
        return '<tr' + rowClass + '>' +
            '<td class="mpc-comparison-row-label">' + labelHtml + '</td>' +
            '<td class="mpc-comparison-row-value ' + signClass(hourVal) + '">' + hourText + '</td>' +
            '<td class="mpc-comparison-row-value ' + signClass(yearVal) + '">' + yearText + '</td>' +
            '</tr>';
    }
    function escapeAttr(s) { return String(s === null || s === undefined ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

    function makeRoleInstance(typeKey, removable) {
        instanceSeq += 1;
        return { key: typeKey + "-" + instanceSeq, typeKey: typeKey, removable: !!removable };
    }

    function baseRoleDefs() {
        instanceSeq = 0;
        return roleTypeOrder.map(function (typeKey) { return makeRoleInstance(typeKey, false); });
    }

    function defaultStateForRole(r) {
        const meta = roleTypeMeta[r.typeKey];
        return {
            name: "",
            apprenticeYear: meta.hasYear ? 1 : null,
            trade: meta.hasTrade ? "Plumbing" : null,
            wage: null,
            kiwiSaver: true,
            vehicle: A[meta.vehicleKey].value,
            tools: A.defaultTools.value,
            overheads: A.defaultOverheads.value,
            nonBillablePct: A.nonBillablePct.value,
            otherEmploymentCosts: 0,
            markup: 0,
            headcount: 1,
            currentRate: null,
            detailsOpen: false,
            overheadPopupOpen: false,
            vehiclePopupOpen: false
        };
    }

    function defaultSharedVehicleCalc() {
        return { motorExpenses: null, vehicleCount: 1, mode: "total" };
    }

    let sharedVehicleCalc = defaultSharedVehicleCalc();

    // The overhead calculator is business-wide, not per-role - a member only needs to
    // enter their rent, power, insurance etc. once, and every role's Overheads popup
    // draws on the same shared figures.
    const OVERHEAD_CATEGORIES = [
        { key: "rent", label: "Rent & rates" },
        { key: "utilities", label: "Power, water & gas" },
        { key: "phone", label: "Phone & internet" },
        { key: "software", label: "Software subscriptions" },
        { key: "insurance", label: "Business insurance" },
        { key: "marketing", label: "Marketing & advertising" },
        { key: "accountancy", label: "Accountancy & professional fees" },
        { key: "adminWages", label: "Admin/office wages" },
        { key: "supplies", label: "Office supplies" },
        { key: "memberships", label: "Memberships & training" },
        { key: "other", label: "Other overheads" }
    ];

    function defaultSharedOverheadCalc() {
        const items = {};
        OVERHEAD_CATEGORIES.forEach(function (c) { items[c.key] = null; });
        return { items: items, staffCount: 1, mode: "total", totalAnnual: null, customItems: [], customSeq: 0 };
    }

    let sharedOverheadCalc = defaultSharedOverheadCalc();

    function initRoleState() {
        roleDefs = baseRoleDefs();
        roleState = {};
        roleDefs.forEach(function (r) { roleState[r.key] = defaultStateForRole(r); });
        groupMode = {};
        roleTypeOrder.forEach(function (typeKey) { groupMode[typeKey] = "individuals"; });
        sharedOverheadCalc = defaultSharedOverheadCalc();
        sharedVehicleCalc = defaultSharedVehicleCalc();
    }
    initRoleState();

    function tradeTitleFor(typeKey, roleTrade) {
        const trade = roleTrade || "Plumbing";
        if (typeKey === "certifier") {
            if (trade === "Plumbing") return "Certifying Plumber";
            if (trade === "Gasfitting") return "Certifying Gasfitter";
            return "Certifying Drainlayer";
        }
        if (typeKey === "tradesperson") {
            if (trade === "Gasfitting") return "Gasfitter";
            if (trade === "Drainlaying") return "Drainlayer";
            return "Plumber";
        }
        return roleTypeMeta[typeKey].baseLabel;
    }

    function pricingFractionForDisplay(state) {
        if (state.markup === null || state.markup === undefined || !Number.isFinite(Number(state.markup))) return null;
        return Number(state.markup) / (1 + Number(state.markup));
    }

    function pricingLabel() { return "Target margin on labour charge-out rate (%)"; }
    function pricingShortLabel() { return "Target margin on labour rate (%)"; }

    function computeRole(state) {
        const wage = state.wage;
        if (wage === null || wage === "") return { hasWage: false };
        if (isNaN(wage) || wage < 0) return { hasWage: true, error: "Hourly wage can't be negative." };

        const hoursPerWeek = A.hoursPerWeek.value;
        const weeksPaid = A.weeksPaidPerYear.value;
        const annualWage = wage * hoursPerWeek * weeksPaid;
        const cappedWage = Math.min(annualWage, A.accMaxLiableEarnings.value);
        const accWork = cappedWage * A.accWorkLevy.value;
        const accSafer = cappedWage * A.accSaferLevy.value;
        const kiwiSaver = state.kiwiSaver ? annualWage * A.kiwiSaverPct.value : 0;
        const otherEmploymentCosts = Number(state.otherEmploymentCosts) || 0;
        const totalEmploymentCost = annualWage + accWork + accSafer + kiwiSaver + otherEmploymentCosts;

        const paidHours = hoursPerWeek * weeksPaid;
        const annualLeaveHours = hoursPerWeek * A.annualLeaveWeeks.value;
        const publicHolidayHours = (A.publicHolidayDays.value / 5) * hoursPerWeek;
        const sickLeaveHours = (A.sickLeaveDays.value / 5) * hoursPerWeek;
        const hoursWorked = paidHours - annualLeaveHours - publicHolidayHours - sickLeaveHours;
        if (hoursWorked <= 0) return { hasWage: true, error: "Paid leave assumptions add up to more than paid hours." };

        let nonBillable = Number(state.nonBillablePct);
        if (isNaN(nonBillable)) nonBillable = 0;
        if (nonBillable < 0) nonBillable = 0;
        if (nonBillable > 0.99) return { hasWage: true, error: "Non-billable time must be below 100%." };
        const billableHours = hoursWorked * (1 - nonBillable);
        if (billableHours <= 0) return { hasWage: true, error: "Billable hours came out at zero or below." };

        const trueLabourCostPerHour = totalEmploymentCost / billableHours;
        const vehicle = Number(state.vehicle) || 0;
        const tools = Number(state.tools) || 0;
        const includedVehicle = vehicleRecoveryMode === "included" ? vehicle : 0;
        const separatelyRecoveredVehicle = vehicleRecoveryMode === "separate" ? vehicle : 0;
        const overheads = Number(state.overheads) || 0;
        const totalOverhead = includedVehicle + tools + overheads;
        const overheadPerHour = totalOverhead / billableHours;
        const trueFullCost = trueLabourCostPerHour + overheadPerHour;

        const hasTarget = state.markup !== null && state.markup !== undefined && state.markup !== "" && Number(state.markup) > 0;
        let markup = null;
        let marginPct = null;
        if (hasTarget) {
            markup = Number(state.markup);
            if (!Number.isFinite(markup)) return { hasWage: true, error: "Target margin must be below 100%." };
            if (markup < 0) markup = 0;
            marginPct = markup / (1 + markup);
        }

        const gasLoading = state.trade === "Gasfitting" ? A.gasfittingLoading.value : 0;
        const baseSuggestedExGST = hasTarget ? trueFullCost * (1 + markup) : null;
        const suggestedExGST = hasTarget ? baseSuggestedExGST * (1 + gasLoading) : null;
        const suggestedIncGST = hasTarget ? suggestedExGST * (1 + A.gstRate.value) : null;

        const headcount = Math.max(1, Math.round(Number(state.headcount) || 1));
        let currentRate = state.currentRate;
        if (currentRate === "" || currentRate === undefined) currentRate = null;
        if (currentRate !== null) currentRate = Number(currentRate);

        let profitPerHour = null, profitPerMonth = null, profitPerYear = null;
        let currentImpliedMargin = null;
        let targetPositionPerHour = null, targetPositionPerMonth = null, targetPositionPerYear = null;
        if (currentRate !== null && !isNaN(currentRate)) {
            profitPerHour = currentRate - trueFullCost;
            profitPerYear = profitPerHour * billableHours * headcount;
            profitPerMonth = profitPerYear / 12;
            if (currentRate > 0) currentImpliedMargin = (currentRate - trueFullCost) / currentRate;
            if (hasTarget) {
                targetPositionPerHour = currentRate - suggestedExGST;
                targetPositionPerYear = targetPositionPerHour * billableHours * headcount;
                targetPositionPerMonth = targetPositionPerYear / 12;
            }
        }

        return {
            hasWage: true, error: null,
            annualWage, accWork, accSafer, kiwiSaver, otherEmploymentCosts, totalEmploymentCost, cappedWage,
            paidHours, annualLeaveHours, publicHolidayHours, sickLeaveHours, hoursWorked,
            nonBillable, billableHours, trueLabourCostPerHour,
            vehicle, tools, includedVehicle, separatelyRecoveredVehicle, overheads, totalOverhead, overheadPerHour,
            trueFullCost, hasTarget, markup, marginPct, gasLoading, baseSuggestedExGST, suggestedExGST, suggestedIncGST,
            headcount, currentRate,
            profitPerHour, profitPerMonth, profitPerYear, currentImpliedMargin,
            targetPositionPerHour, targetPositionPerMonth, targetPositionPerYear
        };
    }

    function renderRolesPreservingInput(selector, rawValue, selectionStart, selectionEnd) {
        renderRoles();
        const newEl = rolesEl.querySelector(selector);
        if (!newEl) return;
        newEl.value = rawValue;
        suppressNextAutoSelect = true;
        try { newEl.focus({ preventScroll: true }); } catch (err) { newEl.focus(); }
        if (document.activeElement === newEl) {
            const len = newEl.value.length;
            const start = Math.min(selectionStart === null || selectionStart === undefined ? len : selectionStart, len);
            const end = Math.min(selectionEnd === null || selectionEnd === undefined ? start : selectionEnd, len);
            try { newEl.setSelectionRange(start, end); } catch (err) { }
        }
    }

    function tradeSelectHtml(r, state) {
        const meta = roleTypeMeta[r.typeKey];
        if (!meta.hasTrade) return '';
        const options = TRADE_OPTIONS.map(function (t) {
            return '<option value="' + t + '" ' + (state.trade === t ? 'selected' : '') + '>' + t + '</option>';
        }).join('');
        return '<select class="mpc-role-trade-select" aria-label="Trade for this row" data-role="' + r.key + '" data-field="trade">' + options + '</select>';
    }

    function roleCellHtml(r, state, typeTitle) {
        const meta = roleTypeMeta[r.typeKey];
        const tradeSelect = tradeSelectHtml(r, state);
        const nameInput = '<input type="text" class="mpc-role-name-input" autocomplete="off" spellcheck="false" placeholder="Name / group label (optional)" aria-label="Name or group label for this ' + escapeAttr(typeTitle) + ' row" data-role="' + r.key + '" data-field="name" value="' + escapeAttr(state.name) + '">';
        const removeButton = r.removable ? '<button type="button" class="mpc-remove-apprentice" data-remove-role="' + r.key + '">remove this row</button>' : '';
        if (!meta.hasYear) return '<div class="mpc-role-choice">' + tradeSelect + nameInput + removeButton + '</div>';
        const options = [1, 2, 3, 4].map(function (year) {
            return '<option value="' + year + '" ' + (Number(state.apprenticeYear) === year ? 'selected' : '') + '>Year ' + year + '</option>';
        }).join('');
        return '<div class="mpc-role-choice"><select aria-label="Apprentice year" data-role="' + r.key + '" data-field="apprenticeYear">' + options + '</select>' + nameInput + removeButton + '</div>';
    }


    const VEHICLE_ONLY_HELP_TEXT = 'Annual running cost of the vehicle dedicated to this role: lease/finance repayments, fuel, WOF &amp; registration, insurance, servicing/repairs and tyres, plus depreciation if the business owns the vehicle outright.<br><br>If you already claim vehicle costs using IRD\'s kilometre rate method (business kms &times; the published rate) rather than actual costs, use that total here instead - it already bundles all running costs, so don\'t add the items above on top. See Assumptions &amp; sources below for the IRD reference.';
    const TOOLS_ONLY_HELP_TEXT = 'Only include tools/equipment paid for by the business on an ongoing basis. If staff buy tools on account and pay it off themselves through a wage deduction, that is not a net cost to the business - leave this at $0 for that arrangement.';
    const OVERHEADS_HELP_HTML =
        '<strong>INCLUDE:</strong> rent &amp; rates, power/water/gas, phone &amp; internet, software subscriptions, general business insurance, marketing &amp; advertising, accountancy &amp; other professional fees, admin/office wages, office supplies, trade/professional association memberships, staff training, and depreciation on office equipment (not vehicles - those are modelled separately).<br><br>' +
        '<strong>EXCLUDE:</strong><br>' +
        '&bull; ACC and KiwiSaver - already modelled elsewhere in the calculator<br>' +
        '&bull; Loan interest and finance costs - a financing cost, not an operating overhead<br>' +
        '&bull; One-off or capital costs - e.g. legal settlements, bad debts<br><br>' +
        '<strong>DIRECTORS / SHAREHOLDERS:</strong> do not include director/shareholder salaries, shareholder salaries, drawings or other profit distributions in this overhead allocation. If a director or owner does billable trade work, add them as their own team row instead so their cost and billable capacity are modelled consistently.';

    function vehicleToolsCellHtml(r, state, displayName) {
        return '<div class="mpc-mobile-cell-label">Vehicle &amp; tools ($/year)</div>' +
            '<div class="mpc-cost-pair">' +
            '<label class="mpc-subinput"><span class="mpc-heading-with-help">Vehicle<span class="mpc-help"><button type="button" class="mpc-help-button" aria-label="About Vehicle">?</button><span class="mpc-help-bubble mpc-help-bubble-wide" role="tooltip">' + VEHICLE_ONLY_HELP_TEXT + '</span></span></span><div class="mpc-vehicle-popup-anchor"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="mpc-estimate mpc-vehicle-field" aria-label="' + displayName + ' annual vehicle cost" data-role="' + r.key + '" data-field="vehicle" value="' + editableGroupedNumber(state.vehicle, 4) + '">' + vehicleFieldPopupHtml(r.key, state) + '</div></label>' +
            '<label class="mpc-subinput"><span class="mpc-heading-with-help">Tools<span class="mpc-help"><button type="button" class="mpc-help-button" aria-label="About Tools">?</button><span class="mpc-help-bubble" role="tooltip">' + TOOLS_ONLY_HELP_TEXT + '</span></span></span><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="mpc-estimate" aria-label="' + displayName + ' annual tools cost" data-role="' + r.key + '" data-field="tools" value="' + editableGroupedNumber(state.tools, 4) + '"></label>' +
            '</div>';
    }


    function targetMarginControlHtml(r, state, displayName, result) {
        const marginFraction = pricingFractionForDisplay(state);
        const hasValue = marginFraction !== null && Number.isFinite(marginFraction);
        const pct = hasValue ? marginFraction * 100 : 0;
        const isSet = hasValue && pct > 0;
        const rangeValue = Math.min(99, Math.max(0, pct));
        const equivalentMarkup = isSet && result && result.hasWage && !result.error
            ? 'Equivalent markup: ' + (result.markup * 100).toFixed(1) + '%'
            : (isSet ? 'Equivalent markup: ' + (Number(state.markup) * 100).toFixed(1) + '%' : 'Required: enter a target margin above 0%');
        const statusId = 'margin-status-' + r.key;
        return '<div class="mpc-target-control ' + (isSet ? '' : 'mpc-target-unset') + '">' +
            '<div class="mpc-target-entry"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="mpc-estimate mpc-target-number" aria-label="' + displayName + ' target margin on labour charge-out rate percentage" aria-invalid="' + (isSet ? 'false' : 'true') + '" aria-describedby="' + statusId + '" data-role="' + r.key + '" data-field="pricingPct" value="' + editableNumber(pct, 2) + '" placeholder="0"><span class="mpc-percent-suffix">%</span></div>' +
            '<input type="range" class="mpc-target-range" min="0" max="99" step="0.5" value="' + rangeValue + '" data-target-range="' + r.key + '" aria-label="' + displayName + ' target margin on labour charge-out rate slider" aria-valuetext="' + (isSet ? editableNumber(pct, 1) + ' percent' : '0 percent - enter a value above 0 percent to calculate a target rate') + '">' +
            '<div class="mpc-target-scale"><span>0%</span><span>&lt;100%</span></div>' +
            '<div class="mpc-target-status" id="' + statusId + '">' + equivalentMarkup + '</div>' +
            (isSet ? '<button type="button" class="mpc-reset-icon" data-reset-role="' + r.key + '" data-reset-field="pricingPct">reset to 0%</button>' : '') +
            '</div>';
    }

    function renderRoles() {
        rolesEl.innerHTML = "";
        let anyComparisonKnown = false;
        let comparisonRoleCount = 0, targetComparisonCount = 0;
        let totalProfitMonth = 0, totalProfitYear = 0, totalUpliftYear = 0, totalAboveTargetYear = 0, comparisonHeadcount = 0, totalModelledHeadcount = 0;

        const intro = document.createElement("div");
        intro.className = "mpc-table-intro";
        intro.innerHTML = '<h2>Your team, costs &amp; pricing</h2><p>Each row can represent one person or a group on the same assumptions. Annual vehicle, tools and overhead inputs are per person/FTE. Add another row when wages, trade, productivity or costs differ.</p>';
        rolesEl.appendChild(intro);

        const table = document.createElement("div");
        table.className = "mpc-input-table";
        table.setAttribute("role", "table");
        table.setAttribute("aria-label", "Charge out rate inputs by role");
        table.innerHTML = '<div class="mpc-table-head" role="row">' +
            '<div role="columnheader">Role / trade</div>' +
            '<div role="columnheader">Headcount</div>' +
            '<div role="columnheader">Hourly wage<br>paid ($)</div>' +
            '<div role="columnheader">KiwiSaver<br>member?</div>' +
            '<div role="columnheader">Non-billable<br>time (%)</div>' +
            '<div role="columnheader">Vehicle &amp; tools<br>($/person/year)</div>' +
            '<div role="columnheader">Allocated overheads<br>($/person/year)</div>' +
            '<div role="columnheader">True full<br>cost ($/hr)</div>' +
            '<div role="columnheader">Current rate<br>($/hr) optional</div>' +
            '<div role="columnheader">Target margin on labour rate (%)</div>' +
            '<div role="columnheader">Calculated target<br>rate ($/hr)</div>' +
            '</div>';

        roleTypeOrder.forEach(function (typeKey) {
            const instances = roleDefs.filter(function (r) { return r.typeKey === typeKey; });
            const visibleInstances = instances;
            const bannerTitle = roleTypeMeta[typeKey].baseLabel;

            const banner = document.createElement("div");
            banner.className = "mpc-role-banner";
            banner.innerHTML = bannerTitle + ' <span class="mpc-role-banner-note">(one row can represent one person or a group. Add another row whenever wage, trade, billable time or cost assumptions differ.' + (roleTypeMeta[typeKey].hasTrade ? ' Choose the trade on each row.' : '') + ')</span>';
            table.appendChild(banner);

            visibleInstances.forEach(function (r, idx) {
                const state = roleState[r.key];
                const result = computeRole(state);
                const meta = roleTypeMeta[r.typeKey];
                const typeTitle = meta.hasTrade ? tradeTitleFor(r.typeKey, state.trade) : meta.baseLabel;
                const baseDisplayName = meta.hasYear ? "Apprentice Year " + state.apprenticeYear : typeTitle;
                const displayName = state.name ? (baseDisplayName + " - " + state.name) : baseDisplayName;

                if (result.hasWage && !result.error) totalModelledHeadcount += result.headcount;
                if (result.hasWage && !result.error && result.currentRate !== null && !isNaN(result.currentRate)) {
                    anyComparisonKnown = true;
                    comparisonRoleCount += 1;
                    comparisonHeadcount += result.headcount;
                    totalProfitMonth += result.profitPerMonth;
                    totalProfitYear += result.profitPerYear;
                    if (result.hasTarget) {
                        targetComparisonCount += 1;
                        if (result.targetPositionPerYear < 0) {
                            totalUpliftYear += Math.abs(result.targetPositionPerYear);
                        } else if (result.targetPositionPerYear > 0) {
                            totalAboveTargetYear += result.targetPositionPerYear;
                        }
                    }
                }

                let rateHtml;
                if (result.hasWage && result.error) {
                    rateHtml = '<div class="mpc-rate-cell-box mpc-rate-empty"><strong>Check inputs</strong><span>See warning</span></div>';
                } else if (result.hasWage && result.hasTarget) {
                    rateHtml = '<div class="mpc-rate-cell-box"><strong>' + fmtMoney(result.suggestedExGST) + '</strong><span>excl. GST</span><span><strong>' + fmtMoney(result.suggestedIncGST) + '</strong> incl. GST</span>' + (vehicleRecoveryMode === 'separate' && result.vehicle > 0 ? '<span>+ vehicle recovery separately</span>' : '') + '</div>';
                } else if (result.hasWage) {
                    rateHtml = '<div class="mpc-rate-cell-box mpc-rate-empty mpc-rate-needs-margin"><strong>Enter margin &gt; 0%</strong><span>to calculate target rate</span></div>';
                } else {
                    rateHtml = '<div class="mpc-readout">-</div>';
                }

                const group = document.createElement("div");
                group.className = "mpc-role-group";
                group.setAttribute("role", "rowgroup");

                const row = document.createElement("div");
                row.className = "mpc-role-row";
                row.setAttribute("role", "row");
                row.innerHTML =
                    '<div class="mpc-cell mpc-role-cell" data-label="Role / trade" role="rowheader">' + roleCellHtml(r, state, bannerTitle) + '<button type="button" class="mpc-details-toggle" data-details-role="' + r.key + '" aria-expanded="' + (state.detailsOpen ? 'true' : 'false') + '">' + (state.detailsOpen ? 'Hide details' : 'How this rate is calculated') + '</button></div>' +
                    '<div class="mpc-cell" data-label="Headcount" role="cell"><input type="text" inputmode="numeric" autocomplete="off" class="mpc-neutral" aria-label="' + displayName + ' headcount" data-role="' + r.key + '" data-field="headcount" value="' + state.headcount + '"></div>' +
                    '<div class="mpc-cell" data-label="Hourly wage paid ($)" role="cell"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="mpc-required" aria-label="' + displayName + ' hourly wage paid" data-role="' + r.key + '" data-field="wage" value="' + (state.wage === null ? '' : editableGroupedNumber(state.wage, 4)) + '" placeholder="0.00">' + (result.hasWage && result.error ? '<div class="mpc-warning">' + result.error + '</div>' : '') + '</div>' +
                    '<div class="mpc-cell" data-label="KiwiSaver member?" role="cell"><select aria-label="' + displayName + ' KiwiSaver member" data-role="' + r.key + '" data-field="kiwiSaver"><option value="yes" ' + (state.kiwiSaver ? 'selected' : '') + '>Yes</option><option value="no" ' + (!state.kiwiSaver ? 'selected' : '') + '>No</option></select></div>' +
                    '<div class="mpc-cell" data-label="Non-billable time (%)" role="cell"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="mpc-estimate" aria-label="' + displayName + ' non-billable time percentage" data-role="' + r.key + '" data-field="nonBillablePct" value="' + editablePct(state.nonBillablePct) + '"><button type="button" class="mpc-reset-icon" data-reset-role="' + r.key + '" data-reset-field="nonBillablePct">reset</button></div>' +
                    '<div class="mpc-cell mpc-has-mobile-label" data-label="Vehicle & tools ($/person/year)" role="cell">' + vehicleToolsCellHtml(r, state, displayName) + '</div>' +
                    '<div class="mpc-cell" data-label="Allocated overheads ($/person/year)" role="cell"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="mpc-estimate" aria-label="' + displayName + ' annual allocated overheads" data-role="' + r.key + '" data-field="overheads" value="' + editableGroupedNumber(state.overheads, 4) + '"><span class="mpc-helper-text">per person/FTE; allocation or override</span></div>' +
                    '<div class="mpc-cell" data-label="True full cost ($/hr)" role="cell"><div class="mpc-readout">' + (result.hasWage && !result.error ? fmtMoney(result.trueFullCost) : '-') + '</div></div>' +
                    '<div class="mpc-cell" data-label="Current charge out rate ($/hr) (optional)" role="cell"><input type="text" inputmode="decimal" autocomplete="off" spellcheck="false" class="mpc-neutral" aria-label="' + displayName + ' current charge out rate, optional" data-role="' + r.key + '" data-field="currentRate" value="' + (state.currentRate === null ? '' : editableGroupedNumber(state.currentRate, 4)) + '" placeholder="optional">' + (result.hasWage ? '' : '<span class="mpc-helper-text">Enter a wage</span>') + '</div>' +
                    '<div class="mpc-cell mpc-target-cell" data-label="Target margin on labour rate (%)" role="cell">' + targetMarginControlHtml(r, state, displayName, result) + '</div>' +
                    '<div class="mpc-cell" data-label="Calculated target rate ($/hr)" role="cell">' + rateHtml + '</div>';

                const details = document.createElement("div");
                details.className = 'mpc-row-details ' + (state.detailsOpen ? 'open' : '');
                details.setAttribute("data-details", r.key);

                const missingWage = !result.hasWage;
                const missingRate = state.currentRate === null || state.currentRate === "";
                let comparisonPlaceholder = 'Enter an hourly wage and your current rate to see your position.';
                if (!missingWage && missingRate) comparisonPlaceholder = 'Enter your current rate to see your position.';
                else if (missingWage && !missingRate) comparisonPlaceholder = 'Enter an hourly wage above to see your position.';
                let comparisonHtml = '<div class="mpc-detail-kpi"><span class="label">Rate comparison</span><span class="value" style="font-size:.8rem;font-weight:650;">' + comparisonPlaceholder + '</span></div>';
                if (result.hasWage && !result.error && result.currentRate !== null && !isNaN(result.currentRate)) {
                    const useCurrentButton = result.currentImpliedMargin !== null && result.currentImpliedMargin > 0 && result.currentImpliedMargin < 0.99
                        ? '<button type="button" class="mpc-use-current-margin" data-use-current-margin="' + r.key + '">Use my current margin as my target</button>'
                        : '';
                    const impliedMarginNote = result.currentImpliedMargin !== null
                        ? '<div class="mpc-comparison-submeta">Your current implied margin: <strong>' + (result.currentImpliedMargin * 100).toFixed(1) + '%</strong>' + (useCurrentButton ? ' ' + useCurrentButton : '') + '</div>'
                        : '';

                    const currentWord = result.profitPerHour < 0 ? 'LOSS' : 'PROFIT';
                    let rowsHtml = comparisonRowHtml('Using your current rate', currentWord, result.profitPerHour, result.profitPerYear, false);

                    if (result.hasTarget) {
                        const targetProfitPerHour = result.suggestedExGST - result.trueFullCost;
                        const targetProfitPerYear = targetProfitPerHour * result.billableHours * result.headcount;
                        const targetWord = targetProfitPerHour < 0 ? 'LOSS' : 'PROFIT';
                        rowsHtml += comparisonRowHtml('Using calculated target rate', targetWord, targetProfitPerHour, targetProfitPerYear, false);

                        const missingProfitPerHour = result.suggestedExGST - result.currentRate;
                        if (missingProfitPerHour > 0) {
                            const missingProfitPerYear = missingProfitPerHour * result.billableHours * result.headcount;
                            rowsHtml += comparisonRowHtml("<span class=\"mpc-comparison-opportunity-title\">Profit opportunity lost</span><span class=\"mpc-comparison-row-note\">(difference between your current charge-out rate and the calculated target rate)</span>", null, missingProfitPerHour, missingProfitPerYear, true);
                        }
                    } else {
                        rowsHtml += '<tr><td colspan="3" class="mpc-comparison-table-empty">Enter a target margin above 0% to see your position using the calculated target rate.</td></tr>';
                    }

                    comparisonHtml =
                        '<div class="mpc-comparison-table-wrap">' +
                        '<div class="mpc-comparison-flex-row">' +
                        '<table class="mpc-comparison-table">' +
                        '<thead><tr><th></th><th>Per hour</th><th>Per year</th></tr></thead>' +
                        '<tbody>' + rowsHtml + '</tbody>' +
                        '</table>' +
                        impliedMarginNote +
                        '</div>' +
                        '</div>';
                }

                let auditHtml = '<div class="mpc-audit-note">Enter an hourly wage to see the full cost bridge.</div>';
                if (result.hasWage && !result.error) {
                    const nonBillableHours = result.hoursWorked - result.billableHours;
                    const vehiclePerHour = result.billableHours > 0 ? result.vehicle / result.billableHours : 0;
                    const toolsPerHour = result.billableHours > 0 ? result.tools / result.billableHours : 0;
                    const overheadPerHour = result.billableHours > 0 ? result.overheads / result.billableHours : 0;
                    auditHtml =
                        '<div class="mpc-audit-note">Figures in this cost bridge are per person/FTE.' + (result.headcount > 1 ? ' Annual current-rate and target comparisons multiply these figures by headcount ' + result.headcount + '.' : '') + '</div>' +
                        '<div class="mpc-audit-grid">' +
                        '<div class="mpc-audit-step"><span class="label">Annual wages</span><span class="value">' + fmtMoneyWhole(result.annualWage) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Employer ACC + Working Safer</span><span class="value">' + fmtMoneyWhole(result.accWork + result.accSafer) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Employer KiwiSaver</span><span class="value">' + fmtMoneyWhole(result.kiwiSaver) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Other direct employment costs</span><span class="value">' + fmtMoneyWhole(result.otherEmploymentCosts) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Total employment cost</span><span class="value">' + fmtMoneyWhole(result.totalEmploymentCost) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Paid hours / year</span><span class="value">' + fmtHours(result.paidHours) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Paid leave removed</span><span class="value">' + fmtHours(result.annualLeaveHours + result.publicHolidayHours + result.sickLeaveHours) + ' hrs</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Other non-billable time</span><span class="value">' + fmtHours(nonBillableHours) + ' hrs</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Billable hours / year</span><span class="value">' + fmtHours(result.billableHours) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Employment cost / billable hr</span><span class="value">' + fmtMoney(result.trueLabourCostPerHour) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Vehicle / billable hr' + (vehicleRecoveryMode === 'separate' ? ' (recovered separately)' : '') + '</span><span class="value">' + fmtMoney(vehiclePerHour) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Tools / billable hr</span><span class="value">' + fmtMoney(toolsPerHour) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">Overheads / billable hr</span><span class="value">' + fmtMoney(overheadPerHour) + '</span></div>' +
                        '<div class="mpc-audit-step"><span class="label">True full cost in labour rate</span><span class="value">' + fmtMoney(result.trueFullCost) + '</span></div>' +
                        (vehicleRecoveryMode === 'separate' ? '<div class="mpc-audit-step mpc-audit-wide"><span class="label">Vehicle cost that must be recovered separately</span><span class="value">' + fmtMoneyWhole(result.separatelyRecoveredVehicle) + '/yr · ' + fmtMoney(vehiclePerHour) + '/billable hr equivalent</span></div>' : '') +
                        '</div>';
                }

                details.innerHTML =
                    '<div class="mpc-details-grid">' +
                    '<div class="mpc-details-section-title">How this rate is calculated</div>' +
                    '<div class="mpc-field"><label>Other direct employment costs / allowances ($/person/year)</label><input type="text" inputmode="decimal" autocomplete="off" data-role="' + r.key + '" data-field="otherEmploymentCosts" value="' + editableGroupedNumber(state.otherEmploymentCosts || 0, 4) + '"><span class="mpc-helper-text">Optional: regular allowances, licences/certification, employer-paid PPE/uniforms, on-call allowances or other direct role costs.</span></div>' +
                    auditHtml +
                    '<div class="mpc-details-section-title">Current rate &amp; target comparison</div>' +
                    comparisonHtml +
                    '</div>';

                group.appendChild(row);
                group.appendChild(details);
                table.appendChild(group);
            });

            const addRow = document.createElement("div");
            addRow.className = "mpc-apprentice-tools";
            addRow.innerHTML = '<button type="button" class="mpc-add-apprentice" data-add-role="' + typeKey + '">+ Add another ' + bannerTitle + '</button>';
            table.appendChild(addRow);
        });

        rolesEl.appendChild(table);

        attachRoleListeners();
        renderSummary(anyComparisonKnown, totalProfitMonth, totalProfitYear, totalUpliftYear, totalAboveTargetYear, comparisonHeadcount, totalModelledHeadcount, comparisonRoleCount, targetComparisonCount);
        renderGlobalControls();
    }

    function overheadItemsTotal() {
        let total = 0;
        OVERHEAD_CATEGORIES.forEach(function (c) { total += Number(sharedOverheadCalc.items[c.key]) || 0; });
        (sharedOverheadCalc.customItems || []).forEach(function (item) { total += Number(item.amount) || 0; });
        return total;
    }

    function overheadFieldPopupHtml(roleKey, state) {
        if (!state.overheadPopupOpen) return '';
        const mode = sharedOverheadCalc.mode === "itemised" ? "itemised" : "total";
        const tabsHtml = '<div class="mpc-oh-popup-tabs">' +
            '<button type="button" class="' + (mode === "total" ? "active" : "") + '" data-oh-popup-tab="total" data-oh-popup-role="' + roleKey + '">Enter a total</button>' +
            '<button type="button" class="' + (mode === "itemised" ? "active" : "") + '" data-oh-popup-tab="itemised" data-oh-popup-role="' + roleKey + '">Itemised entry</button>' +
            '</div>';

        let bodyHtml;
        if (mode === "itemised") {
            const rowsHtml = OVERHEAD_CATEGORIES.map(function (c) {
                return '<div class="mpc-field"><label>' + c.label + ' ($)</label><input type="text" inputmode="decimal" autocomplete="off" data-oh-field="' + c.key + '" value="' + (sharedOverheadCalc.items[c.key] === null ? '' : editableGroupedNumber(sharedOverheadCalc.items[c.key], 4)) + '"></div>';
            }).join('');
            const customRowsHtml = (sharedOverheadCalc.customItems || []).map(function (item) {
                return '<div class="mpc-field mpc-oh-custom-row"><label>Item name<button type="button" class="mpc-oh-remove-custom" data-oh-remove-custom="' + item.id + '" aria-label="Remove this item">&times; remove</button></label><input type="text" autocomplete="off" spellcheck="false" placeholder="e.g. Cleaning" data-oh-custom-label="' + item.id + '" value="' + escapeAttr(item.label) + '"><label style="margin-top:4px;">Amount ($)</label><input type="text" inputmode="decimal" autocomplete="off" data-oh-custom-amount="' + item.id + '" value="' + (item.amount === null ? '' : editableGroupedNumber(item.amount, 4)) + '"></div>';
            }).join('');
            const total = overheadItemsTotal();
            const sc = Number(sharedOverheadCalc.staffCount) || 1;
            const perStaff = total / sc;
            const resultHtml = total > 0
                ? 'Total: <span class="mpc-minicalc-result">' + fmtMoneyWhole(total) + '/yr</span> &nbsp; &divide; ' + sc + ' staff = <span class="mpc-minicalc-result">' + fmtMoneyWhole(perStaff) + '/yr each</span> &nbsp; <button type="button" class="mpc-minicalc-use" data-oh-use="' + roleKey + '">Apply to this role</button>'
                : '<span style="color:var(--text-muted);">Enter your overhead items and billable staff count.</span> <button type="button" class="mpc-minicalc-use" disabled style="opacity:.5;">Apply to this role</button>';
            bodyHtml = '<p class="mpc-overhead-calc-note"><strong>ENTER ANNUAL FIGURES:</strong> These figures are business-wide - enter them once and they\'re available from every role. Come back and edit them any time.</p>' +
                '<div class="mpc-minicalc-row mpc-overhead-items-grid">' + rowsHtml + customRowsHtml + '</div>' +
                '<button type="button" class="mpc-oh-add-custom" data-oh-add-custom="1">+ Add another item</button>' +
                '<div class="mpc-field"><label>Number of billable staff</label><input type="text" inputmode="numeric" autocomplete="off" data-oh-field="staffCount" value="' + sc + '"></div>' +
                '<div class="mpc-minicalc-result-row">' + resultHtml + '</div>';
        } else {
            bodyHtml = '<p class="mpc-overhead-calc-note">Type your annual overhead figure straight into the field, or switch to Itemised entry to build it up from individual costs like rent, power and insurance.</p>';
        }

        return '<div class="mpc-oh-popup">' + tabsHtml + bodyHtml + '<button type="button" class="mpc-oh-popup-close" data-oh-popup-close="' + roleKey + '">Done</button></div>';
    }

    function vehicleFieldPopupHtml(roleKey, state) {
        if (!state.vehiclePopupOpen) return '';
        const mode = sharedVehicleCalc.mode === "split" ? "split" : "total";
        const tabsHtml = '<div class="mpc-oh-popup-tabs">' +
            '<button type="button" class="' + (mode === "total" ? "active" : "") + '" data-veh-popup-tab="total" data-veh-popup-role="' + roleKey + '">Enter total for this vehicle</button>' +
            '<button type="button" class="' + (mode === "split" ? "active" : "") + '" data-veh-popup-tab="split" data-veh-popup-role="' + roleKey + '">Split total costs amongst all vehicles</button>' +
            '</div>';

        let bodyHtml;
        if (mode === "split") {
            const me = sharedVehicleCalc.motorExpenses;
            const vc = Number(sharedVehicleCalc.vehicleCount) || 1;
            const hasAmount = me !== null && Number(me) > 0;
            const perVehicle = hasAmount ? Number(me) / vc : 0;
            const resultHtml = hasAmount
                ? 'Per vehicle: <span class="mpc-minicalc-result">' + fmtMoneyWhole(perVehicle) + '/yr</span> &nbsp; <button type="button" class="mpc-minicalc-use" data-veh-use="' + roleKey + '">Apply to this role</button>'
                : '<span style="color:var(--text-muted);">Enter your total motor expenses and vehicle count.</span> <button type="button" class="mpc-minicalc-use" disabled style="opacity:.5;">Apply to this role</button>';
            bodyHtml = '<p class="mpc-overhead-calc-note">This split is business-wide - enter it once and reuse it for every vehicle field. Come back and edit it any time.</p>' +
                '<div class="mpc-minicalc-row">' +
                '<div class="mpc-field"><label>Total annual motor expenses ($)</label><input type="text" inputmode="decimal" autocomplete="off" data-veh-field="motorExpenses" value="' + (me === null ? '' : editableGroupedNumber(me, 4)) + '"></div>' +
                '<div class="mpc-field"><label>Number of vehicles</label><input type="text" inputmode="numeric" autocomplete="off" data-veh-field="vehicleCount" value="' + vc + '"></div>' +
                '</div>' +
                '<div class="mpc-minicalc-result-row">' + resultHtml + '</div>';
        } else {
            bodyHtml = '<p class="mpc-overhead-calc-note">Type this vehicle\'s annual running cost straight into the field, or switch to the split option if several vehicles share one pool of costs.</p>';
        }

        return '<div class="mpc-oh-popup">' + tabsHtml + bodyHtml + '<button type="button" class="mpc-oh-popup-close" data-veh-popup-close="' + roleKey + '">Done</button></div>';
    }

    function renderSummary(anyKnown, profitMonth, profitYear, upliftYear, aboveTargetYear, comparisonHeadcount, totalModelledHeadcount, comparisonRoleCount, targetComparisonCount) {
        if (!anyKnown) {
            summaryEl.innerHTML = '<h3>Business-wide position</h3><p class="mpc-summary-empty">' + (totalModelledHeadcount > 0 ? 'You have costed ' + totalModelledHeadcount + ' staff/FTE. Add the current charge-out rate on the rows you want to compare to see the estimated labour profit/(loss) at today\'s pricing.' : 'Enter an hourly wage to cost your team, then add current charge-out rates for the rows you want to compare.') + '</p>';
            return;
        }

        let targetStat;
        if (comparisonRoleCount > 0 && targetComparisonCount === comparisonRoleCount) {
            let targetNote;
            if (upliftYear > 0) {
                targetNote = 'Additional annual labour revenue if below-target rows are lifted to their selected targets.';
                if (aboveTargetYear > 0) targetNote += ' Other compared rows are already ' + fmtSignedMoneyWhole(aboveTargetYear) + '/yr above target.';
            } else if (aboveTargetYear > 0) {
                targetNote = 'No uplift needed. Current rates are already at or above target; compared rows are ' + fmtSignedMoneyWhole(aboveTargetYear) + '/yr above target in total.';
            } else {
                targetNote = 'No uplift needed. Current rates are on the selected targets.';
            }
            targetStat = '<div class="mpc-summary-stat"><span class="label">Additional labour revenue to reach target - per year</span><span class="value mpc-neutral-value">' + (upliftYear > 0 ? fmtSignedMoneyWhole(upliftYear) : '$0') + '</span><span class="mpc-target-word">' + targetNote + '</span></div>';
        } else {
            const missing = Math.max(0, comparisonRoleCount - targetComparisonCount);
            targetStat = '<div class="mpc-summary-stat"><span class="label">Additional labour revenue to reach target - per year</span><span class="value mpc-neutral-value">Not set</span><span class="mpc-target-word">Enter a target margin above 0% for ' + missing + ' compared row' + (missing === 1 ? '' : 's') + '</span></div>';
        }

        const summaryMonthWord = profitMonth < 0 ? 'LOSS' : 'PROFIT';
        const summaryYearWord = profitYear < 0 ? 'LOSS' : 'PROFIT';
        summaryEl.innerHTML = '<h3>Business-wide position</h3>' +
            '<p>Current-rate profit/(loss) is calculated only for rows where a current charge-out rate has been entered. Labour pricing only; separately recovered vehicle/travel and job-specific revenue are not included.</p>' +
            '<div class="mpc-summary-grid">' +
            '<div class="mpc-summary-stat"><span class="label">Est. labour <strong>' + summaryMonthWord + '</strong> at current rates - per month</span><span class="value ' + signClass(profitMonth) + '">' + fmtSignedMoneyWhole(profitMonth) + '</span></div>' +
            '<div class="mpc-summary-stat"><span class="label">Est. labour <strong>' + summaryYearWord + '</strong> at current rates - per year</span><span class="value ' + signClass(profitYear) + '">' + fmtSignedMoneyWhole(profitYear) + '</span></div>' +
            targetStat +
            '<div class="mpc-summary-stat"><span class="label">Staff included in current-rate comparison</span><span class="value mpc-neutral-value">' + comparisonHeadcount + '</span><span class="mpc-target-word">Total staff/FTE costed: ' + totalModelledHeadcount + '</span></div>' +
            '</div>';
    }


    let globalTargetMarginPct = 0;
    const globalTargetEl = document.getElementById("mpc-global-target");
    const globalOverheadEl = document.getElementById("mpc-global-overheads");
    const globalOverheadStaffEl = document.getElementById("mpc-global-overhead-staff");
    const globalOverheadStatusEl = document.getElementById("mpc-overhead-allocation-status");
    const businessOverheadItemsEl = document.getElementById("mpc-business-overhead-items");
    const businessOverheadTotalEl = document.getElementById("mpc-business-overheads-total");
    const targetMarginReadoutEl = document.getElementById("mpc-target-margin-readout");
    const targetMarkupReadoutEl = document.getElementById("mpc-target-markup-readout");
    const targetInsightNoteEl = document.getElementById("mpc-target-insight-note");
    const vehicleInsightNoteEl = document.getElementById("mpc-vehicle-insight-note");

    function modelledHeadcount() {
        let total = 0;
        roleDefs.forEach(function (r) {
            const state = roleState[r.key];
            if (!state || state.wage === null || state.wage === "" || isNaN(state.wage)) return;
            total += Math.max(1, Math.round(Number(state.headcount) || 1));
        });
        return total;
    }

    function itemisedBusinessOverheadTotal() { return overheadItemsTotal(); }

    function allocatedOverheadAcrossModel() {
        let total = 0;
        roleDefs.forEach(function (r) {
            const state = roleState[r.key];
            if (!state || state.wage === null || state.wage === "" || isNaN(state.wage)) return;
            total += (Number(state.overheads) || 0) * Math.max(1, Math.round(Number(state.headcount) || 1));
        });
        return total;
    }

    function renderBusinessOverheadBuilder() {
        if (!businessOverheadItemsEl) return;
        const standardRows = OVERHEAD_CATEGORIES.map(function (c) {
            const v = sharedOverheadCalc.items[c.key];
            return '<label>' + c.label + ' ($)<input type="text" inputmode="decimal" autocomplete="off" data-global-oh-item="' + c.key + '" value="' + (v === null ? '' : editableGroupedNumber(v, 4)) + '"></label>';
        }).join('');
        const customRows = (sharedOverheadCalc.customItems || []).map(function (item) {
            return '<div class="mpc-oh-custom-row"><label>Custom item <button type="button" class="mpc-oh-remove-custom" data-global-oh-remove="' + item.id + '">&times; remove</button></label><input type="text" autocomplete="off" spellcheck="false" placeholder="e.g. Cleaning" data-global-oh-custom-label="' + item.id + '" value="' + escapeAttr(item.label || '') + '"><label style="margin-top:4px;">Amount ($)</label><input type="text" inputmode="decimal" autocomplete="off" data-global-oh-custom-amount="' + item.id + '" value="' + (item.amount === null ? '' : editableGroupedNumber(item.amount, 4)) + '"></div>';
        }).join('');
        businessOverheadItemsEl.innerHTML = standardRows + customRows;

        function syncItemisedTotal() {
            const total = itemisedBusinessOverheadTotal();
            sharedOverheadCalc.totalAnnual = total > 0 ? total : null;
            if (businessOverheadTotalEl) businessOverheadTotalEl.innerHTML = total > 0 ? 'Itemised total: <strong>' + fmtMoneyWhole(total) + '/year</strong>. This automatically updates the <strong>Annual business overheads</strong> field in this panel.' : 'No itemised overheads entered yet.';
            renderGlobalControls(false);
        }

        businessOverheadItemsEl.querySelectorAll('[data-global-oh-item]').forEach(function (el) {
            el.addEventListener('input', function (e) {
                const key = e.target.getAttribute('data-global-oh-item');
                sharedOverheadCalc.items[key] = parseUserNumber(e.target.value);
                syncItemisedTotal();
            });
            el.addEventListener('blur', function (e) {
                const key = e.target.getAttribute('data-global-oh-item');
                const v = sharedOverheadCalc.items[key];
                e.target.value = v === null ? '' : editableGroupedNumber(v, 4);
            });
        });
        businessOverheadItemsEl.querySelectorAll('[data-global-oh-custom-label]').forEach(function (el) {
            el.addEventListener('input', function (e) {
                const id = e.target.getAttribute('data-global-oh-custom-label');
                const item = (sharedOverheadCalc.customItems || []).find(function (x) { return x.id === id; });
                if (item) item.label = e.target.value;
            });
        });
        businessOverheadItemsEl.querySelectorAll('[data-global-oh-custom-amount]').forEach(function (el) {
            el.addEventListener('input', function (e) {
                const id = e.target.getAttribute('data-global-oh-custom-amount');
                const item = (sharedOverheadCalc.customItems || []).find(function (x) { return x.id === id; });
                if (item) item.amount = parseUserNumber(e.target.value);
                syncItemisedTotal();
            });
        });
        businessOverheadItemsEl.querySelectorAll('[data-global-oh-remove]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const id = btn.getAttribute('data-global-oh-remove');
                sharedOverheadCalc.customItems = (sharedOverheadCalc.customItems || []).filter(function (x) { return x.id !== id; });
                const total = itemisedBusinessOverheadTotal();
                sharedOverheadCalc.totalAnnual = total > 0 ? total : null;
                renderGlobalControls();
            });
        });
        const total = itemisedBusinessOverheadTotal();
        businessOverheadTotalEl.innerHTML = (total > 0 ? 'Itemised total: <strong>' + fmtMoneyWhole(total) + '/year</strong>. This automatically updates the <strong>Annual business overheads</strong> field in this panel.' : 'No itemised overheads entered yet.') + ' <button type="button" class="mpc-small-button" id="mpc-global-oh-add">+ Add custom item</button>';
        const addBtn = document.getElementById('mpc-global-oh-add');
        if (addBtn) addBtn.addEventListener('click', function () {
            sharedOverheadCalc.customSeq = (sharedOverheadCalc.customSeq || 0) + 1;
            sharedOverheadCalc.customItems = sharedOverheadCalc.customItems || [];
            sharedOverheadCalc.customItems.push({ id: 'custom-' + sharedOverheadCalc.customSeq, label: '', amount: null });
            renderGlobalControls();
        });
    }

    function renderGlobalControls(rebuildItems) {
        if (rebuildItems === undefined) rebuildItems = true;
        if (document.activeElement !== globalTargetEl) globalTargetEl.value = globalTargetMarginPct > 0 ? editableNumber(globalTargetMarginPct, 2) : '';
        if (document.activeElement !== globalOverheadEl) globalOverheadEl.value = sharedOverheadCalc.totalAnnual === null ? '' : editableGroupedNumber(sharedOverheadCalc.totalAnnual, 2);
        if (document.activeElement !== globalOverheadStaffEl) globalOverheadStaffEl.value = Math.max(1, Math.round(Number(sharedOverheadCalc.staffCount) || 1));
        if (targetMarginReadoutEl && targetMarkupReadoutEl && targetInsightNoteEl) {
            const marginPct = Math.min(99.99, Math.max(0, Number(globalTargetMarginPct) || 0));
            if (marginPct > 0) {
                const margin = marginPct / 100;
                const markupPct = margin / (1 - margin) * 100;
                targetMarginReadoutEl.textContent = editableNumber(marginPct, 2) + '%';
                targetMarkupReadoutEl.textContent = editableNumber(markupPct, 1) + '%';
                targetInsightNoteEl.textContent = 'A ' + editableNumber(marginPct, 1) + '% margin means the target rate leaves ' + editableNumber(marginPct, 1) + '% of revenue after the fully loaded costs modelled here.';
            } else {
                targetMarginReadoutEl.textContent = 'Not set';
                targetMarkupReadoutEl.textContent = 'Not set';
                targetInsightNoteEl.textContent = 'Enter a margin to see the equivalent markup on fully loaded cost.';
            }
        }
        const total = Number(sharedOverheadCalc.totalAnnual) || 0;
        const staff = Math.max(1, Math.round(Number(sharedOverheadCalc.staffCount) || 1));
        const allocated = allocatedOverheadAcrossModel();
        const modelled = modelledHeadcount();
        const perFte = total > 0 ? total / staff : 0;
        const useHeadcountBtn = document.getElementById('mpc-use-modelled-headcount');
        const applyOverheadsBtn = document.getElementById('mpc-apply-overheads');
        if (useHeadcountBtn) useHeadcountBtn.textContent = modelled > 0 ? 'Use team total (' + modelled + ' FTE)' : 'Use team headcount below';
        if (applyOverheadsBtn) applyOverheadsBtn.textContent = total > 0 ? 'Apply ' + fmtMoneyWhole(perFte) + '/FTE to all rows' : 'Apply per-FTE allocation to all rows';
        if (total > 0) {
            let allocationCheck = '';
            if (modelled > 0) {
                allocationCheck = ' After applying, the team model can be checked against the business total. Current row allocations total <strong>' + fmtMoneyWhole(allocated) + '</strong>.';
                if (Math.abs(allocated - total) <= 1) allocationCheck += ' This currently matches the business total.';
                else allocationCheck += ' If you expect it to match ' + fmtMoneyWhole(total) + ', check the staff/FTE denominator or any row-level overrides.';
            }
            globalOverheadStatusEl.innerHTML = '<div class="mpc-overhead-formula"><strong>Allocation:</strong> ' + fmtMoneyWhole(total) + ' annual overheads &divide; ' + staff + ' billable staff/FTE = <strong>' + fmtMoneyWhole(perFte) + ' per person/FTE per year</strong>.' + allocationCheck + '</div>';
        } else {
            globalOverheadStatusEl.innerHTML = 'Enter your annual overheads, or build the total from the categories directly below. The itemised total will flow into the annual total automatically.';
        }
        if (rebuildItems) renderBusinessOverheadBuilder();
    }

    globalTargetEl.addEventListener('input', function (e) { globalTargetMarginPct = Math.max(0, Number(parseUserNumber(e.target.value)) || 0); renderGlobalControls(false); });
    globalTargetEl.addEventListener('blur', function () { renderGlobalControls(false); });
    document.getElementById('mpc-apply-target').addEventListener('click', function () {
        const margin = Math.min(99.99, Math.max(0, globalTargetMarginPct)) / 100;
        const markup = margin <= 0 ? 0 : margin / (1 - margin);
        roleDefs.forEach(function (r) { roleState[r.key].markup = markup; });
        renderRoles();
    });

    globalOverheadEl.addEventListener('input', function (e) { sharedOverheadCalc.totalAnnual = parseUserNumber(e.target.value); renderGlobalControls(false); });
    globalOverheadEl.addEventListener('blur', function () { renderGlobalControls(false); });
    globalOverheadStaffEl.addEventListener('input', function (e) { const n = parseUserNumber(e.target.value); sharedOverheadCalc.staffCount = n === null ? 1 : Math.max(1, Math.round(n)); renderGlobalControls(false); });
    document.getElementById('mpc-use-modelled-headcount').addEventListener('click', function () { sharedOverheadCalc.staffCount = Math.max(1, modelledHeadcount()); renderGlobalControls(); });
    document.getElementById('mpc-apply-overheads').addEventListener('click', function () {
        const total = Number(sharedOverheadCalc.totalAnnual) || 0;
        const staff = Math.max(1, Math.round(Number(sharedOverheadCalc.staffCount) || 1));
        if (total <= 0) return;
        const allocation = Math.round(total / staff);
        roleDefs.forEach(function (r) { roleState[r.key].overheads = allocation; });
        renderRoles();
    });

    function attachRoleListeners() {
        rolesEl.querySelectorAll("input[data-role][data-field]").forEach(function (el) {
            el.addEventListener("input", onFieldChange);
            el.addEventListener("blur", function (e) {
                const role = e.target.getAttribute("data-role");
                const field = e.target.getAttribute("data-field");
                if (!["wage", "vehicle", "tools", "overheads", "currentRate", "otherEmploymentCosts"].includes(field)) return;
                const value = roleState[role][field];
                e.target.value = value === null ? "" : editableGroupedNumber(value, 4);
            });
        });
        rolesEl.querySelectorAll("select[data-role][data-field]").forEach(function (el) { el.addEventListener("change", onFieldChange); });

        rolesEl.querySelectorAll(".mpc-details-toggle").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const key = btn.getAttribute("data-details-role");
                roleState[key].detailsOpen = !roleState[key].detailsOpen;
                renderRoles();
            });
        });

        rolesEl.querySelectorAll(".mpc-reset-icon").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const role = btn.getAttribute("data-reset-role");
                const field = btn.getAttribute("data-reset-field");
                const rDef = roleDefs.find(function (r) { return r.key === role; });
                const meta = roleTypeMeta[rDef.typeKey];
                if (field === "vehicle") roleState[role].vehicle = A[meta.vehicleKey].value;
                else if (field === "tools") roleState[role].tools = A.defaultTools.value;
                else if (field === "overheads") roleState[role].overheads = A.defaultOverheads.value;
                else if (field === "nonBillablePct") roleState[role].nonBillablePct = A.nonBillablePct.value;
                else if (field === "pricingPct") roleState[role].markup = 0;
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-target-range]").forEach(function (el) {
            el.addEventListener("input", function (e) {
                const role = e.target.getAttribute("data-target-range");
                const pct = Number(e.target.value);
                e.target.classList.remove("unset");
                const cell = e.target.closest(".mpc-target-control");
                if (cell) {
                    cell.classList.remove("mpc-target-unset");
                    const numberInput = cell.querySelector('[data-field="pricingPct"]');
                    const status = cell.querySelector('.mpc-target-status');
                    if (numberInput) numberInput.value = editableNumber(pct, 1);
                    if (status) {
                        const margin = pct / 100;
                        const markup = margin >= 1 ? null : margin / (1 - margin);
                        status.textContent = markup === null ? 'Gross margin must be below 100%' : 'Equivalent markup: ' + (markup * 100).toFixed(1) + '%';
                    }
                }
            });
            el.addEventListener("change", function (e) {
                const role = e.target.getAttribute("data-target-range");
                const margin = Number(e.target.value) / 100;
                roleState[role].markup = margin >= 1 ? Infinity : margin / (1 - margin);
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-use-current-margin]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const role = btn.getAttribute("data-use-current-margin");
                const result = computeRole(roleState[role]);
                if (result.currentImpliedMargin === null || result.currentImpliedMargin <= 0 || result.currentImpliedMargin >= 0.99) return;
                roleState[role].markup = result.currentImpliedMargin / (1 - result.currentImpliedMargin);
                renderRoles();
            });
        });

        rolesEl.querySelectorAll(".mpc-vehicle-field").forEach(function (el) {
            el.addEventListener("focus", function (e) {
                const role = e.target.getAttribute("data-role");
                if (roleState[role].vehiclePopupOpen) return;
                Object.keys(roleState).forEach(function (key) { roleState[key].vehiclePopupOpen = false; roleState[key].overheadPopupOpen = false; });
                roleState[role].vehiclePopupOpen = true;
                renderRolesPreservingInput('.mpc-vehicle-field[data-role="' + role + '"]', e.target.value, e.target.value.length, e.target.value.length);
            });
        });

        rolesEl.querySelectorAll("[data-veh-popup-tab]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                sharedVehicleCalc.mode = btn.getAttribute("data-veh-popup-tab");
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-veh-popup-close]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const role = btn.getAttribute("data-veh-popup-close");
                roleState[role].vehiclePopupOpen = false;
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-veh-field]").forEach(function (el) {
            el.addEventListener("input", function (e) {
                const field = e.target.getAttribute("data-veh-field");
                const raw = e.target.value;
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const parsed = parseUserNumber(raw);
                if (field === "vehicleCount") {
                    sharedVehicleCalc.vehicleCount = parsed === null ? 1 : Math.max(1, Math.round(parsed));
                } else {
                    sharedVehicleCalc.motorExpenses = parsed;
                }
                const selector = '[data-veh-field="' + field + '"]';
                renderRolesPreservingInput(selector, raw, start, end);
            });
            el.addEventListener("blur", function (e) {
                const field = e.target.getAttribute("data-veh-field");
                if (field !== "motorExpenses") return;
                const value = sharedVehicleCalc.motorExpenses;
                e.target.value = value === null ? "" : editableGroupedNumber(value, 4);
            });
        });

        rolesEl.querySelectorAll("[data-veh-use]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const role = btn.getAttribute("data-veh-use");
                const me = Number(sharedVehicleCalc.motorExpenses);
                const vc = Number(sharedVehicleCalc.vehicleCount) || 1;
                if (me > 0) roleState[role].vehicle = Math.round(me / vc);
                roleState[role].vehiclePopupOpen = false;
                renderRoles();
            });
        });


        // Shared, business-wide overhead breakdown calculator - the same figures show up
        // under every role, so entering them once is enough.
        rolesEl.querySelectorAll("[data-oh-field]").forEach(function (el) {
            el.addEventListener("input", function (e) {
                const field = e.target.getAttribute("data-oh-field");
                const raw = e.target.value;
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const parsed = parseUserNumber(raw);
                if (field === "staffCount") {
                    sharedOverheadCalc.staffCount = parsed === null ? 1 : Math.max(1, Math.round(parsed));
                } else {
                    sharedOverheadCalc.items[field] = parsed;
                }
                const selector = '[data-oh-field="' + field + '"]';
                renderRolesPreservingInput(selector, raw, start, end);
            });
            el.addEventListener("blur", function (e) {
                const field = e.target.getAttribute("data-oh-field");
                if (field === "staffCount") return;
                const value = sharedOverheadCalc.items[field];
                e.target.value = value === null ? "" : editableGroupedNumber(value, 4);
            });
        });

        rolesEl.querySelectorAll("[data-oh-use]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const role = btn.getAttribute("data-oh-use");
                const total = overheadItemsTotal();
                const sc = Number(sharedOverheadCalc.staffCount) || 1;
                if (total > 0) roleState[role].overheads = Math.round(total / sc);
                roleState[role].overheadPopupOpen = false;
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-oh-popup-tab]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                sharedOverheadCalc.mode = btn.getAttribute("data-oh-popup-tab");
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-oh-popup-close]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const role = btn.getAttribute("data-oh-popup-close");
                roleState[role].overheadPopupOpen = false;
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-oh-add-custom]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                sharedOverheadCalc.customSeq = (sharedOverheadCalc.customSeq || 0) + 1;
                sharedOverheadCalc.customItems = sharedOverheadCalc.customItems || [];
                sharedOverheadCalc.customItems.push({ id: "custom-" + sharedOverheadCalc.customSeq, label: "", amount: null });
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-oh-remove-custom]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const id = btn.getAttribute("data-oh-remove-custom");
                sharedOverheadCalc.customItems = (sharedOverheadCalc.customItems || []).filter(function (item) { return item.id !== id; });
                renderRoles();
            });
        });

        rolesEl.querySelectorAll("[data-oh-custom-label]").forEach(function (el) {
            el.addEventListener("input", function (e) {
                const id = e.target.getAttribute("data-oh-custom-label");
                const raw = e.target.value;
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const item = (sharedOverheadCalc.customItems || []).find(function (it) { return it.id === id; });
                if (item) item.label = raw;
                renderRolesPreservingInput('[data-oh-custom-label="' + id + '"]', raw, start, end);
            });
        });

        rolesEl.querySelectorAll("[data-oh-custom-amount]").forEach(function (el) {
            el.addEventListener("input", function (e) {
                const id = e.target.getAttribute("data-oh-custom-amount");
                const raw = e.target.value;
                const start = e.target.selectionStart;
                const end = e.target.selectionEnd;
                const parsed = parseUserNumber(raw);
                const item = (sharedOverheadCalc.customItems || []).find(function (it) { return it.id === id; });
                if (item) item.amount = parsed;
                renderRolesPreservingInput('[data-oh-custom-amount="' + id + '"]', raw, start, end);
            });
            el.addEventListener("blur", function (e) {
                const id = e.target.getAttribute("data-oh-custom-amount");
                const item = (sharedOverheadCalc.customItems || []).find(function (it) { return it.id === id; });
                if (!item) return;
                e.target.value = item.amount === null ? "" : editableGroupedNumber(item.amount, 4);
            });
        });

        rolesEl.querySelectorAll(".mpc-overhead-field").forEach(function (el) {
            el.addEventListener("focus", function (e) {
                const role = e.target.getAttribute("data-role");
                if (roleState[role].overheadPopupOpen) return;
                Object.keys(roleState).forEach(function (key) { roleState[key].overheadPopupOpen = false; roleState[key].vehiclePopupOpen = false; });
                roleState[role].overheadPopupOpen = true;
                renderRolesPreservingInput('.mpc-overhead-field[data-role="' + role + '"]', e.target.value, e.target.value.length, e.target.value.length);
            });
        });

        rolesEl.querySelectorAll("[data-add-role]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                addRoleInstance(btn.getAttribute("data-add-role"));
            });
        });

        rolesEl.querySelectorAll("[data-remove-role]").forEach(function (btn) {
            btn.addEventListener("click", function () {
                const key = btn.getAttribute("data-remove-role");
                roleDefs = roleDefs.filter(function (r) { return r.key !== key; });
                delete roleState[key];
                renderRoles();
            });
        });

    }

    function onFieldChange(e) {
        const role = e.target.getAttribute("data-role");
        const field = e.target.getAttribute("data-field");
        const raw = e.target.value;

        if (field === "kiwiSaver") {
            roleState[role].kiwiSaver = raw === "yes";
            renderRoles();
            return;
        }
        if (field === "apprenticeYear") {
            roleState[role].apprenticeYear = Math.min(4, Math.max(1, Number(raw) || 1));
            renderRoles();
            return;
        }
        if (field === "trade") {
            roleState[role].trade = TRADE_OPTIONS.indexOf(raw) !== -1 ? raw : "Plumbing";
            renderRoles();
            return;
        }
        if (field === "name") {
            const start = e.target.selectionStart;
            const end = e.target.selectionEnd;
            roleState[role].name = raw;
            renderRolesPreservingInput('[data-role="' + role + '"][data-field="name"]', raw, start, end);
            return;
        }

        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        const parsed = parseUserNumber(raw);

        if (field === "wage") roleState[role].wage = parsed;
        else if (field === "currentRate") {
            roleState[role].currentRate = parsed;
            if (parsed !== null) roleState[role].detailsOpen = true;
        }
        else if (field === "pricingPct") {
            if (parsed === null) roleState[role].markup = 0;
            else {
                const margin = Math.max(0, parsed) / 100;
                roleState[role].markup = margin >= 1 ? Infinity : margin / (1 - margin);
            }
        } else if (field === "nonBillablePct") roleState[role].nonBillablePct = parsed === null ? 0 : parsed / 100;
        else if (field === "headcount") roleState[role].headcount = parsed === null ? 1 : Math.max(1, Math.round(parsed));
        else roleState[role][field] = parsed === null ? 0 : parsed;

        const selector = '[data-role="' + role + '"][data-field="' + field + '"]';
        renderRolesPreservingInput(selector, raw, start, end);
    }

    function addRoleInstance(typeKey) {
        const def = makeRoleInstance(typeKey, true);
        let lastIndexOfType = -1;
        roleDefs.forEach(function (r, i) { if (r.typeKey === typeKey) lastIndexOfType = i; });
        const insertAt = lastIndexOfType === -1 ? roleDefs.length : lastIndexOfType + 1;
        roleDefs.splice(insertAt, 0, def);
        roleState[def.key] = defaultStateForRole(def);
        roleState[def.key].detailsOpen = true;
        renderRoles();
    }

    function renderVehicleInsight() {
        if (!vehicleInsightNoteEl) return;
        vehicleInsightNoteEl.innerHTML = vehicleRecoveryMode === "included"
            ? '<strong>Selected:</strong> In labour rate — vehicle cost is recovered through the hourly labour rate.'
            : '<strong>Selected:</strong> Separately — vehicle cost is excluded from labour rate and must be recovered through a separate charge.';
    }

    document.getElementById("mpc-vehicle-mode").addEventListener("click", function (e) {
        const btn = e.target.closest("button[data-vehicle-mode]");
        if (!btn) return;
        vehicleRecoveryMode = btn.getAttribute("data-vehicle-mode");
        document.querySelectorAll("#mpc-vehicle-mode button").forEach(function (b) { b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); });
        btn.classList.add("active");
        btn.setAttribute("aria-pressed", "true");
        renderVehicleInsight();
        renderRoles();
    });

    function displayAssumptionValue(a) {
        if (!a.isPct) return editableGroupedNumber(a.value, 6);
        return a.decimals !== undefined ? editableFixedPct(a.value, a.decimals) : editablePct(a.value);
    }

    function renderAssumptions() {
        assumptionListEl.innerHTML = "";
        Object.keys(A).forEach(function (key) {
            const a = A[key];
            const displayVal = displayAssumptionValue(a);
            const row = document.createElement("div");
            row.className = "mpc-assumption-row";
            const linkHtml = a.link ? '<a href="' + a.link + '" target="_blank" rel="noopener noreferrer" class="mpc-source-link">' + (a.linkLabel || 'Source') + ' &#8599;</a>' : '';
            row.innerHTML = '<label>' + a.label + '</label><input type="text" inputmode="decimal" data-assumption="' + key + '" value="' + displayVal + '"><div class="mpc-source">' + a.source + (linkHtml ? ' ' + linkHtml : '') + '</div>';
            assumptionListEl.appendChild(row);
        });
        assumptionListEl.querySelectorAll("input[data-assumption]").forEach(function (el) {
            el.addEventListener("input", function (e) {
                const key = e.target.getAttribute("data-assumption");
                const parsed = parseUserNumber(e.target.value);
                const v = parsed === null ? 0 : parsed;
                A[key].value = A[key].isPct ? v / 100 : v;
                renderRoles();
            });
            el.addEventListener("blur", function (e) {
                const key = e.target.getAttribute("data-assumption");
                e.target.value = displayAssumptionValue(A[key]);
            });
        });
    }

    document.getElementById("mpc-reset-btn").addEventListener("click", function () {
        A = JSON.parse(JSON.stringify(defaultAssumptions));
        vehicleRecoveryMode = "included";
        globalTargetMarginPct = 0;
        document.querySelectorAll("#mpc-vehicle-mode button").forEach(function (b) { const on = b.getAttribute("data-vehicle-mode") === "included"; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
        renderVehicleInsight();
        initRoleState();
        renderAssumptions();
        renderRoles();
        renderGlobalControls();
    });

    const printBtn = document.getElementById("mpc-print-btn");
    const assumptionsEl = document.getElementById("mpc-assumptions");
    const printTradeEl = document.getElementById("mpc-print-trade");
    const printPricingEl = document.getElementById("mpc-print-pricing");
    const printVehicleEl = document.getElementById("mpc-print-vehicle");
    const printDateEl = document.getElementById("mpc-print-date");
    let assumptionsWasOpenBeforePrint = false;

    function tradesRepresentedText() {
        const tradesUsed = [];
        roleDefs.forEach(function (r) {
            if (!roleTypeMeta[r.typeKey].hasTrade) return;
            const state = roleState[r.key];
            if (!state || state.wage === null || state.wage === "" || isNaN(state.wage)) return;
            const t = state.trade || "Plumbing";
            if (tradesUsed.indexOf(t) === -1) tradesUsed.push(t);
        });
        return tradesUsed.length ? tradesUsed.join(", ") : "Plumbing";
    }

    function preparePrintSummary() {
        assumptionsWasOpenBeforePrint = assumptionsEl.open;
        assumptionsEl.open = true;
        printTradeEl.textContent = tradesRepresentedText();
        printPricingEl.textContent = globalTargetMarginPct > 0 ? (globalTargetMarginPct.toFixed(1) + "% default margin; row overrides may apply") : "Role-level margin targets";
        printVehicleEl.textContent = vehicleRecoveryMode === "included" ? "In labour rate" : "Recovered separately";
        printDateEl.textContent = "Printed " + new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
    }
    function restoreAfterPrint() { assumptionsEl.open = assumptionsWasOpenBeforePrint; }
    printBtn.addEventListener("click", function () { preparePrintSummary(); requestAnimationFrame(function () { window.print(); }); });
    window.addEventListener("beforeprint", preparePrintSummary);
    window.addEventListener("afterprint", restoreAfterPrint);

    // ---------- Save my data: export a fresh copy of this file with current inputs pre-loaded ----------
    function buildSavedStatePayload() {
        return {
            version: 3,
            savedAt: new Date().toISOString(),
            A: A,
            vehicleRecoveryMode: vehicleRecoveryMode,
            globalTargetMarginPct: globalTargetMarginPct,
            instanceSeq: instanceSeq,
            groupMode: groupMode,
            sharedOverheadCalc: sharedOverheadCalc,
            sharedVehicleCalc: sharedVehicleCalc,
            roleDefs: roleDefs.map(function (r) { return { key: r.key, typeKey: r.typeKey, removable: r.removable }; }),
            roleState: roleState
        };
    }

    function buildSavedHtml() {
        const payload = buildSavedStatePayload();
        const json = JSON.stringify(payload).replace(/</g, "\\u003c");
        const injected = '<script id="mpc-saved-state">window.__MPC_SAVED_STATE__ = ' + json + ';<' + '/script>\n</head>';
        return PRISTINE_HTML.replace(/<\/head>/i, injected);
    }

    function downloadFallback(outHtml, suggestedName) {
        const blob = new Blob([outHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = suggestedName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }

    async function saveMyData() {
        const outHtml = buildSavedHtml();
        const stamp = new Date().toISOString().slice(0, 10);
        const suggestedName = "Charge-Out-Rate-Calculator-" + stamp + ".html";

        // Chrome/Edge support a real "Save As" dialog that can save to any drive or folder.
        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: suggestedName,
                    types: [{ description: "HTML file", accept: { "text/html": [".html"] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(outHtml);
                await writable.close();
                return;
            } catch (err) {
                if (err && err.name === "AbortError") return; // person cancelled the dialog
                console.error("Save As failed, falling back to a direct download.", err);
            }
        }

        // Firefox, Safari and browsers without File System Access support fall back to a normal download.
        downloadFallback(outHtml, suggestedName);
    }

    document.getElementById("mpc-save-btn").addEventListener("click", saveMyData);

    // ---------- Restore from a previously saved copy ----------
    function restoreFromSavedState(saved) {
        try {
            if (saved.A) {
                Object.keys(saved.A).forEach(function (key) {
                    if (A[key] && saved.A[key] && typeof saved.A[key].value === "number") A[key].value = saved.A[key].value;
                });
            }
            if (saved.vehicleRecoveryMode) vehicleRecoveryMode = saved.vehicleRecoveryMode;
            if (typeof saved.globalTargetMarginPct === "number") globalTargetMarginPct = saved.globalTargetMarginPct;
            if (Array.isArray(saved.roleDefs) && saved.roleDefs.length && saved.roleState) {
                roleDefs = saved.roleDefs.filter(function (r) { return roleTypeMeta[r.typeKey]; });
                roleState = saved.roleState;
                instanceSeq = typeof saved.instanceSeq === "number" ? saved.instanceSeq : instanceSeq;
                // Migrate saves from before trade became a per-row field: fall back to
                // the old global trade (if present) or Plumbing, for any row missing it.
                const legacyTrade = (saved.trade === "Gasfitting" || saved.trade === "Drainlaying") ? saved.trade : "Plumbing";
                roleDefs.forEach(function (r) {
                    const meta = roleTypeMeta[r.typeKey];
                    const state = roleState[r.key];
                    if (!state) return;
                    if (meta.hasTrade && !state.trade) state.trade = legacyTrade;
                    if (!meta.hasTrade) state.trade = null;
                    if (typeof state.headcount !== "number") state.headcount = 1;
                    if (typeof state.otherEmploymentCosts !== "number") state.otherEmploymentCosts = 0;
                    state.overheadPopupOpen = false;
                });
            }
            if (saved.groupMode) {
                roleTypeOrder.forEach(function (typeKey) {
                    if (saved.groupMode[typeKey] === "aggregate" || saved.groupMode[typeKey] === "individuals") {
                        groupMode[typeKey] = saved.groupMode[typeKey];
                    }
                });
            }
            if (saved.sharedOverheadCalc && saved.sharedOverheadCalc.items) {
                OVERHEAD_CATEGORIES.forEach(function (c) {
                    if (typeof saved.sharedOverheadCalc.items[c.key] === "number") {
                        sharedOverheadCalc.items[c.key] = saved.sharedOverheadCalc.items[c.key];
                    }
                });
                if (typeof saved.sharedOverheadCalc.staffCount === "number") {
                    sharedOverheadCalc.staffCount = saved.sharedOverheadCalc.staffCount;
                }
                if (typeof saved.sharedOverheadCalc.totalAnnual === "number") {
                    sharedOverheadCalc.totalAnnual = saved.sharedOverheadCalc.totalAnnual;
                }
                if (saved.sharedOverheadCalc.mode === "total" || saved.sharedOverheadCalc.mode === "itemised") {
                    sharedOverheadCalc.mode = saved.sharedOverheadCalc.mode;
                }
                if (Array.isArray(saved.sharedOverheadCalc.customItems)) {
                    sharedOverheadCalc.customItems = saved.sharedOverheadCalc.customItems
                        .filter(function (item) { return item && typeof item.id === "string"; })
                        .map(function (item) { return { id: item.id, label: typeof item.label === "string" ? item.label : "", amount: typeof item.amount === "number" ? item.amount : null }; });
                    sharedOverheadCalc.customSeq = typeof saved.sharedOverheadCalc.customSeq === "number" ? saved.sharedOverheadCalc.customSeq : sharedOverheadCalc.customItems.length;
                }
            }
            if (saved.sharedVehicleCalc) {
                if (typeof saved.sharedVehicleCalc.motorExpenses === "number") {
                    sharedVehicleCalc.motorExpenses = saved.sharedVehicleCalc.motorExpenses;
                }
                if (typeof saved.sharedVehicleCalc.vehicleCount === "number") {
                    sharedVehicleCalc.vehicleCount = saved.sharedVehicleCalc.vehicleCount;
                }
                if (saved.sharedVehicleCalc.mode === "total" || saved.sharedVehicleCalc.mode === "split") {
                    sharedVehicleCalc.mode = saved.sharedVehicleCalc.mode;
                }
            }
            document.querySelectorAll("#mpc-vehicle-mode button").forEach(function (b) { const on = b.getAttribute("data-vehicle-mode") === vehicleRecoveryMode; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
            renderVehicleInsight();
            renderGlobalControls();
            return true;
        } catch (err) {
            console.error("Could not restore saved data, starting fresh.", err);
            return false;
        }
    }

    // Parse a previously-saved calculator HTML file (as text) and pull out its embedded data.
    function extractSavedStateFromHtml(htmlText) {
        const doc = new DOMParser().parseFromString(htmlText, "text/html");
        const scriptEl = doc.getElementById("mpc-saved-state");
        if (!scriptEl) return null;
        const scriptText = scriptEl.textContent || "";
        const eqIndex = scriptText.indexOf("=");
        if (eqIndex === -1) return null;
        let jsonText = scriptText.slice(eqIndex + 1).trim();
        if (jsonText.endsWith(";")) jsonText = jsonText.slice(0, -1);
        return JSON.parse(jsonText);
    }

    function importSavedText(text, sourceLabel) {
        let saved;
        try {
            saved = extractSavedStateFromHtml(text);
        } catch (err) {
            window.alert("Sorry, the saved data in that file couldn't be read.");
            return;
        }
        if (!saved) {
            window.alert("This doesn't look like a Charge Out Rate Calculator file saved with \"Save my data\".");
            return;
        }
        if (restoreFromSavedState(saved)) {
            renderAssumptions();
            renderRoles();
        } else {
            window.alert("Sorry, that file's data couldn't be loaded.");
        }
    }

    function readAndImportFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) { importSavedText(String(e.target.result)); };
        reader.onerror = function () { window.alert("Sorry, that file couldn't be read."); };
        reader.readAsText(file);
    }

    // Hidden file input used as the fallback "Open" mechanism for browsers without
    // the File System Access API - this still opens the browser's native file/drive
    // picker, so people can browse to any folder or connected drive.
    const openFallbackInput = document.createElement("input");
    openFallbackInput.type = "file";
    openFallbackInput.accept = ".html,text/html";
    openFallbackInput.style.display = "none";
    openFallbackInput.addEventListener("change", function (e) {
        const file = e.target.files && e.target.files[0];
        if (file) readAndImportFile(file);
        openFallbackInput.value = "";
    });
    document.body.appendChild(openFallbackInput);

    async function openMyData() {
        if (window.showOpenFilePicker) {
            try {
                const handles = await window.showOpenFilePicker({
                    types: [{ description: "HTML file", accept: { "text/html": [".html"] } }],
                    multiple: false
                });
                const file = await handles[0].getFile();
                readAndImportFile(file);
                return;
            } catch (err) {
                if (err && err.name === "AbortError") return; // person cancelled the dialog
                console.error("Open dialog failed, falling back to a standard file picker.", err);
            }
        }
        openFallbackInput.click();
    }

    document.getElementById("mpc-open-btn").addEventListener("click", openMyData);

    if (window.__MPC_SAVED_STATE__) {
        restoreFromSavedState(window.__MPC_SAVED_STATE__);
    }

    renderAssumptions();
    renderRoles();
    renderGlobalControls();
})();

