-- Assistente de IA (Claude): desligado por padrao. So o administrador liga,
-- em Configuracoes → Inteligencia artificial, depois de ler o aviso de LGPD.
alter table clinic_settings add column ai_enabled boolean not null default false;
