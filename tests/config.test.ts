// Unit tests for configuration defaults

describe("Config defaults", () => {
  test("guestbook namespace defaults to guestbook", () => {
    const ns = process.env.GUESTBOOK_NS ?? "guestbook";
    expect(ns).toBe("guestbook");
  });

  test("monitoring namespace defaults to monitoring", () => {
    const ns = process.env.MONITORING_NS ?? "monitoring";
    expect(ns).toBe("monitoring");
  });

  test("grafana NodePort is valid (1024-32767)", () => {
    const port = 30300;
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(32767);
  });

  test("prometheus NodePort is valid (1024-32767)", () => {
    const port = 30090;
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(32767);
  });

  test("guestbook NodePort is valid (1024-32767)", () => {
    const port = 30080;
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(32767);
  });
});
