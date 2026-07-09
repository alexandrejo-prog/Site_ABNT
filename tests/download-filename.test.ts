import { describe, expect, it } from "vitest";
import { buildDownloadFileName, slugify, stripFileExtension } from "../src/download-filename";

describe("download filename", () => {
  it("remove apenas a extensao final do arquivo", () => {
    expect(stripFileExtension("documento_ideal_teste_tipos_trabalho_ufla_abnt.docx")).toBe("documento_ideal_teste_tipos_trabalho_ufla_abnt");
  });

  it("normaliza texto para slug seguro", () => {
    expect(slugify("M\u00e9tricas, trabalho e sa\u00fade...", "sem-titulo")).toBe("metricas-trabalho-e-saude");
  });

  it("usa importedFileName com prioridade sobre titulo antigo", () => {
    expect(buildDownloadFileName({
      workType: "tese",
      title: "M\u00e9tricas, trabalho e sa\u00fade...",
      importedFileName: "documento_ideal_teste_tipos_trabalho_ufla_abnt.docx",
    })).toBe("tese-documento-ideal-teste-tipos-trabalho-ufla-abnt.docx");
  });

  it("usa tipo e titulo atual quando nao ha arquivo importado", () => {
    expect(buildDownloadFileName({
      workType: "tese",
      title: "M\u00e9tricas, trabalho e sa\u00fade...",
    })).toBe("tese-metricas-trabalho-e-saude.docx");
  });

  it("gera nome previsivel para artigo simples importado", () => {
    expect(buildDownloadFileName({
      workType: "artigo",
      title: "Outro titulo",
      importedFileName: "Trabalho Final.docx",
    })).toBe("artigo-academico-simples-trabalho-final.docx");
  });

  it("gera nome com projeto-de-pesquisa para trabalho do tipo projeto", () => {
    const fileName = buildDownloadFileName({
      workType: "projeto_pesquisa",
      title: "Estudo sobre solos",
    });
    expect(fileName).toMatch(/^projeto-de-pesquisa/);
    expect(fileName.endsWith(".docx")).toBe(true);
  });

  it("nao gera nome de software para projeto de pesquisa", () => {
    const fileName = buildDownloadFileName({
      workType: "projeto_pesquisa",
      title: "Estudo sobre solos",
      importedFileName: "desenvolvimento-de-software-e-aplicativos.docx",
    });
    expect(fileName).toMatch(/^projeto-de-pesquisa/);
    expect(fileName.startsWith("desenvolvimento-de-software-e-aplicativos")).toBe(false);
  });

  it("gera nome de software apenas para o tipo correspondente", () => {
    const fileName = buildDownloadFileName({
      workType: "software_aplicativo_ufla",
      title: "Aplicativo de monitoramento",
    });
    expect(fileName).toMatch(/^desenvolvimento-de-software/);
  });
});