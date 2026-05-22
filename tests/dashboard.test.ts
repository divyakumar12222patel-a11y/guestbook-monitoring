import * as fs from "fs";
import * as path from "path";

describe("Grafana Dashboard JSON", () => {
  const dashboardPath = path.join(__dirname, "../dashboards/guestbook-overview.json");

  test("dashboard file exists", () => {
    expect(fs.existsSync(dashboardPath)).toBe(true);
  });

  test("dashboard is valid JSON", () => {
    const content = fs.readFileSync(dashboardPath, "utf8");
    expect(() => JSON.parse(content)).not.toThrow();
  });

  test("dashboard has required fields", () => {
    const content = fs.readFileSync(dashboardPath, "utf8");
    const dashboard = JSON.parse(content);
    expect(dashboard).toHaveProperty("title");
    expect(dashboard).toHaveProperty("uid");
    expect(dashboard).toHaveProperty("panels");
    expect(dashboard).toHaveProperty("templating");
  });

  test("dashboard uid is guestbook-overview", () => {
    const content = fs.readFileSync(dashboardPath, "utf8");
    const dashboard = JSON.parse(content);
    expect(dashboard.uid).toBe("guestbook-overview");
  });

  test("dashboard has panels", () => {
    const content = fs.readFileSync(dashboardPath, "utf8");
    const dashboard = JSON.parse(content);
    expect(Array.isArray(dashboard.panels)).toBe(true);
    expect(dashboard.panels.length).toBeGreaterThan(0);
  });

  test("dashboard has datasource template variable", () => {
    const content = fs.readFileSync(dashboardPath, "utf8");
    const dashboard = JSON.parse(content);
    const vars = dashboard.templating?.list ?? [];
    const dsVar = vars.find((v: Record<string, unknown>) => v.name === "datasource");
    expect(dsVar).toBeDefined();
    expect(dsVar?.query).toBe("prometheus");
  });
});
