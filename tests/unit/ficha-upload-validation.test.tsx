// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MetadataFields from "../../src/components/MetadataFields";
import { emptyAcademicFields } from "../../src/ufla-rules";

const fields = {
  ...emptyAcademicFields(),
  workType: "monografia" as const,
  title: "Titulo",
  author: "Maria Silva",
};

const confidence = Object.fromEntries(
  (Object.keys(emptyAcademicFields()) as (keyof typeof fields)[]).map((k) => [k, "nao-avaliada"]),
) as unknown as React.ComponentProps<typeof MetadataFields>["confidence"];

const baseProps = {
  fields,
  confidence,
  updateField: () => {},
  assistedMode: false,
  setAssistedMode: () => {},
  handleBuildDraft: () => {},
  confirmReplaceDraft: false,
  setConfirmReplaceDraft: () => {},
};

const PNG_1x1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

describe("C10 — upload da ficha catalográfica valida tipo e tamanho", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("recusa arquivo não-imagem com mensagem amigável (role=alert)", async () => {
    const onChange = vi.fn();
    render(
      createElement(MetadataFields, {
        ...baseProps,
        onFichaCatalograficaImageChange: onChange,
        onFichaCatalograficaImageRemove: () => {},
      }),
    );
    const input = screen.getByLabelText(/Escolher imagem/) as HTMLInputElement;
    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], "scan.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(input, { target: { files: [pdf] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/não é uma imagem PNG\/JPEG\/WebP válida/i);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("recusa imagem acima do limite de 10 MB", async () => {
    const onChange = vi.fn();
    render(
      createElement(MetadataFields, {
        ...baseProps,
        onFichaCatalograficaImageChange: onChange,
        onFichaCatalograficaImageRemove: () => {},
      }),
    );
    const input = screen.getByLabelText(/Escolher imagem/) as HTMLInputElement;
    const bigPng = new File([new Uint8Array(11 * 1024 * 1024)], "grande.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [bigPng] } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/muito grande/i);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("aceita PNG válido e chama onFichaCatalograficaImageChange", async () => {
    const onChange = vi.fn();
    render(
      createElement(MetadataFields, {
        ...baseProps,
        onFichaCatalograficaImageChange: onChange,
        onFichaCatalograficaImageRemove: () => {},
      }),
    );
    const input = screen.getByLabelText(/Escolher imagem/) as HTMLInputElement;
    const png = new File([PNG_1x1], "ficha.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [png] } });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    const asset = onChange.mock.calls[0][0];
    expect(asset.data).toBeDefined();
    expect(asset.fileName).toBe("ficha.png");
    // dimensões lidas do cabeçalho quando createImageBitmap não existe (jsdom)
    expect(asset.width).toBe(1);
    expect(asset.height).toBe(1);
  });
});
