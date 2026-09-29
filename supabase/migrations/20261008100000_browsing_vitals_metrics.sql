-- Browsing and Web Vitals metrics (PRODUCT_SPEC §5). The SDK sends them from a separate
-- bundle under fixed event keys (browse.*, vitals.*); source_config says which one:
--   browsing:   { "kind": "engaged" | "pages" | "time" | "return" }
--   web_vitals: { "vital": "lcp" | "inp" | "cls" }
alter table public.metrics drop constraint metrics_source_check;
alter table public.metrics add constraint metrics_source_check
  check (source in ('click', 'pageview', 'custom_js', 'datalayer', 'transaction', 'browsing', 'web_vitals'));
