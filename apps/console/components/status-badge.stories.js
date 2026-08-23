import React from "react";
export default { title: "AICP/StatusBadge" };
const Badge = ({ status, children }) => React.createElement("span", { className: `status status-${status}` }, React.createElement("span", { className: "status-dot", "aria-hidden": true }), children);
export const Pass = { render: () => React.createElement(Badge, { status: "success" }, "PASS") };
export const Blocked = { render: () => React.createElement(Badge, { status: "blocked" }, "BLOCKED") };
export const HumanRequired = { render: () => React.createElement(Badge, { status: "human-required" }, "HUMAN REQUIRED") };
