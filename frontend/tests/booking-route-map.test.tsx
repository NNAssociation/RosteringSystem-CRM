import { MapboxMap } from "@/components/shared/MapboxMap";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  fit: vi.fn(),
  remove: vi.fn(),
  markers: [] as any[],
  listeners: {} as Record<string, any>,
  disconnect: vi.fn(),
}));
vi.mock("mapbox-gl", () => ({
  default: {
    Map: class {
      addControl() {}
      resize() {}
      getLayer() {
        return false;
      }
      getSource() {
        return false;
      }
      addSource() {}
      addLayer() {}
      on(event: string, cb: any) {
        state.listeners[event] = cb;
        if (event === "load") cb();
      }
      fitBounds = state.fit;
      remove = state.remove;
    },
    NavigationControl: class {},
    LngLatBounds: class {
      empty = true;
      extend() {
        this.empty = false;
      }
      isEmpty() {
        return this.empty;
      }
    },
    Marker: class {
      remove = vi.fn();
      callbacks: any = {};
      constructor(public options: any) {
        state.markers.push(this);
      }
      setLngLat() {
        return this;
      }
      addTo() {
        return this;
      }
      on(event: string, cb: any) {
        this.callbacks[event] = cb;
      }
      getLngLat() {
        return { lat: 1, lng: 2 };
      }
    },
  },
}));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  state.markers = [];
});
it("keeps the camera steady, adds only in active mode, uses dragend, and cleans up map resources", async () => {
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "test");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect = state.disconnect;
    },
  );
  const choose = vi.fn(),
    move = vi.fn();
  const points = [
    { id: "a", lat: 0, lng: 0, kind: "STOP" as const },
    { id: "b", lat: 1, lng: 1, kind: "VIA" as const },
  ];
  const view = render(<MapboxMap editor points={points} onMove={move} />);
  await waitFor(() => expect(state.fit).toHaveBeenCalledTimes(1));
  state.listeners.click({ lngLat: { lat: 2, lng: 2 } });
  expect(choose).not.toHaveBeenCalled();
  view.rerender(
    <MapboxMap
      editor
      points={[...points, { id: "c", lat: 2, lng: 2, kind: "STOP" }]}
      onMove={move}
      onChoose={choose}
    />,
  );
  expect(state.fit).toHaveBeenCalledTimes(1);
  state.listeners.click({ lngLat: { lat: 2, lng: 2 } });
  expect(choose).toHaveBeenCalledTimes(1);
  const marker = state.markers.at(-1);
  expect(marker.callbacks.drag).toBeUndefined();
  marker.callbacks.dragend();
  expect(move).toHaveBeenCalledWith("c", { lat: 1, lng: 2 });
  view.rerender(<MapboxMap editor points={points} onMove={move} fitVersion={1} />);
  expect(state.fit).toHaveBeenCalledTimes(2);
  view.unmount();
  expect(state.remove).toHaveBeenCalledTimes(1);
  expect(state.disconnect).toHaveBeenCalledTimes(1);
  expect(state.markers.every((m) => m.remove.mock.calls.length > 0)).toBe(true);
});
