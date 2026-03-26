-- Flag que controla se um GrupoMonitoramento é usado como template
-- para auto-criar grupos similares no webhook (tentarAutoVincularGrupo).
-- Default true → retrocompatível com grupos existentes.

ALTER TABLE "grupos_monitoramento"
  ADD COLUMN "auto_expand" BOOLEAN NOT NULL DEFAULT true;
