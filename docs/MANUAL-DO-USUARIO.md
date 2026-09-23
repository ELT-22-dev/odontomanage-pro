# Manual do Usuário — OdontoManage Pro

Guia rápido para a equipe da clínica (recepção, dentistas e administração).

## Primeiro acesso

- **Administrador:** na primeira vez que o sistema é aberto, aparece a *Configuração inicial*.
  Informe o nome da clínica, seu nome, email e uma senha (mínimo 8 caracteres).
- **Demais pessoas da equipe:** o administrador cria o acesso em **Configurações → Equipe** e
  passa a senha inicial. No primeiro acesso, troque a senha em **Configurações → Meu perfil**.
- Esqueceu a senha? Peça ao administrador para redefinir (Configurações → Equipe → ⋯ → Redefinir senha).
- Após 5 senhas erradas, o acesso fica bloqueado por 15 minutos.

## Pacientes

- **Novo paciente:** menu **Pacientes → Novo paciente**. Só o nome é obrigatório. CPF, telefone
  e CEP são formatados automaticamente; o sistema avisa se o CPF for inválido ou já cadastrado.
- **Ficha do paciente:** clique no nome. Abas: Informações, Consultas, Prontuário e Financeiro.
  Dali você agenda, registra prontuário, lança pagamento e manda mensagem pelo WhatsApp.
- **Editar:** botão **Editar** na ficha (ou ⋯ → Editar na lista).
- **Paciente que parou de vir:** em Editar, mude a *Situação* para **Inativo**. Ele some da lista
  padrão e da agenda, mas o histórico continua guardado.
- **Excluir** (só administrador): permitido apenas para quem **não tem prontuário** — prontuário
  tem guarda obrigatória por lei.
- **Trazer pacientes de outro sistema:** exporte a planilha antiga como CSV e use
  **Configurações → Dados → Importar pacientes (CSV)**. O sistema reconhece colunas como Nome, CPF,
  Telefone, Email, Nascimento; mostra uma prévia antes de importar e ignora CPFs repetidos.

## Agenda e consultas

- **Agendar:** botão **Nova consulta** (Dashboard, Agenda, Consultas ou ficha do paciente).
  Escolha paciente, data, horário, duração e dentista.
- **Horário ocupado:** se o mesmo dentista já tem consulta naquele horário, o sistema avisa. Você
  pode cancelar ou confirmar como *encaixe*.
- **Agenda:** visão da semana; clique no dia para ver as consultas. Use as setas ou o campo de
  data para navegar.
- **Ações da consulta** (menu ⋯ na linha): Editar/remarcar, Lembrete por WhatsApp, Confirmar,
  Em atendimento, Finalizar, Faltou, Cancelar, Excluir. Prefira **Cancelar** a excluir, para manter
  o histórico.
- **Lembrete por WhatsApp:** abre o WhatsApp com a mensagem pronta para o paciente — é só enviar.
- **Consultas:** lista com filtros por período, dentista e status, e indicadores do mês
  (inclusive a taxa de faltas).

## Prontuário

- **Novo registro:** na ficha do paciente (botão Prontuário) ou em **Prontuários → Novo registro**.
  Tipos: Evolução, Diagnóstico, Receita, Tratamento.
- Cada registro mostra **quem criou e quem editou**, com data e hora.
- **Imprimir** (ícone de impressora): sai com o cabeçalho da clínica, os dados do registro e a
  linha de assinatura do dentista.

## Financeiro

- **Novo lançamento:** Receita ou Despesa, valor (aceita vírgula), categoria, paciente, forma de
  pagamento, situação (Recebido/Pago, A receber/A pagar, Cancelado), vencimento e parcela.
- **Visão geral:** recebido, a receber, despesas pagas e saldo do período escolhido; gráficos dos
  últimos 6 meses e despesas por categoria.
- **Recebimentos em atraso** aparecem em destaque no topo.
- **Marcar como pago:** menu ⋯ do lançamento → Marcar como pago (a data do pagamento é preenchida).
- **Exportar CSV:** aba Lançamentos → Exportar CSV (abre direto no Excel) — útil para o contador.

## Assistente de IA (se a clínica ligar)

- **Organizar anotação:** em *Novo registro* do prontuário, escreva ou dite o atendimento do seu
  jeito (abreviações valem) no quadro "Anotação livre" e clique em **Organizar com IA**. Os campos
  Evolução, Diagnóstico, Plano e Receita são preenchidos — **confira e corrija antes de salvar**.
- **Resumo do paciente:** na ficha, aba Informações, clique em **Gerar resumo** para ver um resumo
  do histórico, alertas (ex.: alergias registradas) e tratamentos pendentes. Não substitui a
  leitura do prontuário.
- A IA pode errar. Ela só usa o que está registrado e nada é salvo sem você clicar em salvar.

## Configurações

- **Meu perfil:** nome, email e troca de senha.
- **Dados da clínica** (admin): nome, logo, telefone e endereço (aparecem no menu, no login e nos
  prontuários impressos).
- **Equipe** (admin): criar pessoas, tornar administrador, redefinir senha, desativar acesso de
  quem saiu da clínica (o acesso cai na hora).
- **Aparência:** tema claro, escuro ou igual ao do computador.
- **Integrações:** conectar o Google Calendar para as consultas aparecerem na agenda do Google.
- **Inteligência artificial** (admin liga/desliga): assistente de prontuário e resumo do paciente.
- **Dados:** importar/exportar pacientes (CSV) e, para o admin, baixar o backup completo.
- **Auditoria** (admin): quem fez o quê e quando.

## Boas práticas

- Cada pessoa usa **o próprio login** — nunca compartilhe senha.
- Ao sair do computador da recepção, clique em **Sair**.
- Arquivos exportados (CSV, backup) contêm dados de saúde: não envie por grupos de mensagens nem
  deixe em computadores compartilhados.
- Funciona no celular: o menu fica no botão ☰ no canto superior esquerdo.
