#!/usr/bin/env python3
"""Gera o PDF da auditoria de segurança do Pratique + Pilates.

Uso (pacotes isolados, sem install global):
  PYTHONPATH=/tmp/audit-packages python3 docs/security-audit/gerar-relatorio.py
"""

from __future__ import annotations

import sys
from pathlib import Path

for candidate in (Path("/tmp/audit-packages"), Path(__file__).resolve().parent / ".pkgs"):
    if candidate.exists():
        sys.path.insert(0, str(candidate))

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent
PDF_PATH = OUT_DIR / "relatorio-auditoria-seguranca.pdf"
CHART_DIR = OUT_DIR / "_charts"
CHART_DIR.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuBold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuMono", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"))

PALETTE = {
    "critica": "#B91C1C",
    "alta": "#EA580C",
    "media": "#D97706",
    "baixa": "#2563EB",
    "informativa": "#64748B",
    "forte": "#059669",
    "ink": "#1F2937",
    "muted": "#4B5563",
    "line": "#E5E7EB",
    "paper": "#F8FAFC",
    "teal": "#0F6864",
    "mint": "#E8F5F3",
}

SEVERITY_COUNTS = {"crítica": 0, "alta": 2, "média": 2, "baixa": 1, "informativa": 1}
CATEGORY_COUNTS = {
    "Isolamento": 1,
    "Permissão no navegador": 2,
    "IDOR": 0,
    "Chaves expostas": 2,
    "XSS": 1,
}


def xml(text: str) -> str:
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "CoverKicker",
            fontName="DejaVuBold",
            fontSize=10,
            textColor=colors.HexColor(PALETTE["teal"]),
            tracking=1.2,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            "CoverTitle",
            fontName="DejaVuBold",
            fontSize=26,
            leading=32,
            textColor=colors.HexColor(PALETTE["ink"]),
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            "CoverMeta",
            fontName="DejaVu",
            fontSize=11,
            leading=16,
            textColor=colors.HexColor(PALETTE["muted"]),
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "H1",
            fontName="DejaVuBold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor(PALETTE["teal"]),
            spaceBefore=4,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            "H2",
            fontName="DejaVuBold",
            fontSize=12.5,
            leading=16,
            textColor=colors.HexColor(PALETTE["ink"]),
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "Body",
            fontName="DejaVu",
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor(PALETTE["ink"]),
            alignment=TA_JUSTIFY,
            spaceAfter=7,
        )
    )
    styles.add(
        ParagraphStyle(
            "BodyLeft",
            fontName="DejaVu",
            fontSize=9.5,
            leading=13.5,
            textColor=colors.HexColor(PALETTE["ink"]),
            alignment=TA_LEFT,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "Small",
            fontName="DejaVu",
            fontSize=8.2,
            leading=11.5,
            textColor=colors.HexColor(PALETTE["muted"]),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            "Cell",
            fontName="DejaVu",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(PALETTE["ink"]),
        )
    )
    styles.add(
        ParagraphStyle(
            "CellBold",
            fontName="DejaVuBold",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor(PALETTE["ink"]),
        )
    )
    styles.add(
        ParagraphStyle(
            "Chip",
            fontName="DejaVuBold",
            fontSize=7.5,
            leading=10,
            alignment=TA_CENTER,
            textColor=colors.white,
        )
    )
    styles.add(
        ParagraphStyle(
            "CodeBlock",
            fontName="DejaVuMono",
            fontSize=7.2,
            leading=10,
            textColor=colors.HexColor("#111827"),
            backColor=colors.HexColor("#F3F4F6"),
            leftIndent=4,
            rightIndent=4,
            spaceBefore=3,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "IssueTitle",
            fontName="DejaVuBold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor(PALETTE["teal"]),
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            "IssueBody",
            fontName="DejaVuMono",
            fontSize=6.8,
            leading=9.4,
            textColor=colors.HexColor("#111827"),
            alignment=TA_LEFT,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            "Footer",
            fontName="DejaVu",
            fontSize=8,
            textColor=colors.HexColor(PALETTE["muted"]),
        )
    )
    styles.add(
        ParagraphStyle(
            "BulletBody",
            fontName="DejaVu",
            fontSize=9.2,
            leading=13,
            textColor=colors.HexColor(PALETTE["ink"]),
        )
    )
    return styles


def chip(label: str, styles, hex_color: str) -> Table:
    t = Table(
        [[Paragraph(label.upper(), styles["Chip"])]],
        colWidths=[2.4 * cm],
        rowHeights=[0.55 * cm],
    )
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(hex_color)),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ]
        )
    )
    return t


def draw_charts():
    color_for = {
        "crítica": PALETTE["critica"],
        "alta": PALETTE["alta"],
        "média": PALETTE["media"],
        "baixa": PALETTE["baixa"],
        "informativa": PALETTE["informativa"],
    }
    labels = [k for k, v in SEVERITY_COUNTS.items() if v > 0]
    sizes = [SEVERITY_COUNTS[k] for k in labels]
    sev_colors = [color_for[k] for k in labels]
    fig, ax = plt.subplots(figsize=(5.2, 5.2), dpi=140)
    wedges, texts, autotexts = ax.pie(
        sizes,
        labels=None,
        colors=sev_colors,
        startangle=90,
        wedgeprops=dict(width=0.46, edgecolor="white", linewidth=2),
        autopct=lambda p: str(int(round(p * sum(sizes) / 100))),
        pctdistance=0.75,
    )
    for t in autotexts:
        t.set_color("white")
        t.set_fontsize(10)
        t.set_fontweight("bold")
    ax.legend(
        wedges,
        [f"{lab} ({n})" for lab, n in zip(labels, sizes)],
        loc="lower center",
        ncol=2,
        frameon=False,
        fontsize=8,
        bbox_to_anchor=(0.5, -0.08),
    )
    ax.set_title("Achados por severidade", fontsize=11, pad=8)
    fig.tight_layout()
    donut = CHART_DIR / "severidade.png"
    fig.savefig(donut, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    cats = list(CATEGORY_COUNTS.keys())
    vals = list(CATEGORY_COUNTS.values())
    fig, ax = plt.subplots(figsize=(6.4, 3.6), dpi=140)
    bar_colors = [PALETTE["informativa"], PALETTE["alta"], PALETTE["forte"], PALETTE["media"], PALETTE["alta"]]
    ax.bar(cats, vals, color=bar_colors, width=0.62)
    ax.set_ylabel("Achados")
    ax.set_title("Achados por categoria")
    ax.set_ylim(0, max(vals + [1]) + 1)
    ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.tick_params(axis="x", labelsize=8)
    fig.tight_layout()
    bars = CHART_DIR / "categorias.png"
    fig.savefig(bars, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return donut, bars


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(colors.HexColor(PALETTE["teal"]))
    canvas.rect(0, h - 12 * mm, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("DejaVu", 8)
    canvas.drawString(2 * cm, h - 7.5 * mm, "Relatório de Auditoria de Segurança — Pratique + Pilates")
    canvas.setFillColor(colors.HexColor(PALETTE["paper"]))
    canvas.rect(0, 0, w, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor(PALETTE["muted"]))
    canvas.setFont("DejaVu", 8)
    canvas.drawString(2 * cm, 7 * mm, "Confidencial — uso interno do estúdio")
    canvas.drawRightString(w - 2 * cm, 7 * mm, f"Página {doc.page}")
    canvas.setStrokeColor(colors.HexColor(PALETTE["teal"]))
    canvas.setLineWidth(0.6)
    canvas.line(2 * cm, 14 * mm, w - 2 * cm, 14 * mm)
    canvas.restoreState()


def cover_header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(colors.HexColor(PALETTE["teal"]))
    canvas.rect(0, h - 42 * mm, w, 42 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("DejaVuBold", 12)
    canvas.drawString(2 * cm, h - 18 * mm, "PRATIQUE + PILATES")
    canvas.setFont("DejaVu", 9)
    canvas.drawString(2 * cm, h - 28 * mm, "Auditoria pontual da aplicação web  ·  14/09/2026")
    canvas.setFillColor(colors.HexColor(PALETTE["mint"]))
    canvas.rect(0, 0, w, 22 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor(PALETTE["muted"]))
    canvas.setFont("DejaVu", 8)
    canvas.drawString(2 * cm, 10 * mm, "Pratique + Pilates  ·  auditoria pontual das cinco categorias pedidas")
    canvas.restoreState()


ISSUES = [
    {
        "n": 1,
        "md": """# [Segurança] Staff altera o valor da aula e o JSON do estúdio sem checagem no servidor

**Labels sugeridas:** `security`, `alta`

## Problema
O painel esconde do instrutor (papel `staff`) as ações privilegiadas de **alterar o valor da aula**, ver financeiro, gerar cobranças e cadastrar instrutor. O servidor, no `PUT /api/studio`, só preserva `transactions` e restringe o array `instructors`. Qualquer outro campo do documento — inclusive `classPrice`, `clients`, `appointments`, `modalities` e `times` — é gravado como veio no body.

## Por que é explorável
O staff já está autenticado. Basta um `PUT /api/studio` com o JSON completo (o próprio `Studio.save` envia o objeto inteiro). Não precisa da UI. Dá para zerar o valor da aula, apagar alunos ou reescrever a agenda.

## Evidência
`js/admin.js:342` e `1101-1102` — a UI some para staff:
```
actions.innerHTML = isStaff() ? "" : `...editar-valor...`;
function openClassPrice() {
  if (isStaff()) return;
```
`lib/permissions.js:31-48` — o merge de escrita não toca em `classPrice`:
```
export function mergeStudioWrite(incoming, current, user) {
  if (isAdmin(user) || !incoming || typeof incoming !== "object") return incoming;
  const next = { ...incoming, transactions: current.transactions || [] };
  // só instructors é filtrado
```
`api/index.js:79-93` — qualquer usuário logado pode PUT.

## Impacto
Integridade financeira e operacional: preço cobrado, cadastro de alunos e grade de horários ficam sob controle de uma conta que a dona tratou como limitada.

## Sugestão de correção
No servidor, para `staff`, recusar mudança de `classPrice` (e de qualquer campo que a UI já trate como só-admin). Ideal: allowlist de caminhos graváveis por papel, em vez de copiar o JSON inteiro.

## Critérios de aceite
- [ ] `PUT /api/studio` com `classPrice` diferente, autenticado como staff, **não** altera o valor persistido
- [ ] A mesma chamada como admin continua funcionando
- [ ] Transações e o perfil da Bia continuam protegidos
- [ ] Teste automatizado ou script de verificação cobre o caso staff vs admin
""",
    },
    {
        "n": 2,
        "md": """# [Segurança] XSS armazenado no painel via innerHTML sem escape

**Labels sugeridas:** `security`, `alta`

## Problema
O painel monta HTML com `innerHTML`. Existe `escapeHtml` / `escapeAttr`, mas vários campos que o usuário (ou um PUT autenticado) controla entram crus: `status` desconhecido, `time`, `id` em atributos, nome de modalidade no `<option>`, data e horários da grade.

Não há biblioteca de sanitização no projeto (`DOMPurify` etc.).

## Por que é explorável
Um staff (ou admin comprometido) grava um agendamento com `time` ou `status` contendo HTML. Quando a Bia abre a agenda, o script roda **no navegador dela**, com o cookie HttpOnly da sessão admin. `fetch('/api/studio', {credentials:'include'})` permite ler financeiro e gravar o estúdio como a dona.

## Evidência
`js/admin.js:266` — status cai no HTML se não estiver no mapa:
```
return `<span class="chip ${map[status] || ""}">${labels[status] || status}</span>`;
```
Outros pontos: `407` (`${a.time}`), `663`/`714` (`${time}`), `713` `data-time="${time}"`, `751` data no value, `753`/`758` options de horário/modalidade, `1293` horários da grade, `1612` modal de exclusão, `466`/`741` `data-id`/`value` de IDs.

## Impacto
Roubo de sessão efetiva (ações no contexto da vítima), alteração do banco do estúdio, leitura de dados financeiros que o staff não deveria ver.

## Sugestão de correção
Escapar **todo** interpolado em `innerHTML` (incluindo IDs, horários, status, datas). Validar no servidor formato de `time` (`HH:MM`), `status` (enum) e `id` (`[a-z0-9_]+`). Preferir `textContent` / DOM APIs em vez de HTML concatenado.

## Critérios de aceite
- [ ] Payload `<img src=x onerror=alert(1)>` em `time`, `status`, `id` ou nome de modalidade **não** executa script
- [ ] `escapeHtml`/`escapeAttr` aplicados nos pontos listados, ou renderização sem `innerHTML`
- [ ] PUT rejeita campos fora do enum/formato
""",
    },
    {
        "n": 3,
        "md": """# [Segurança] Segredos de exemplo e chave de acesso na URL

**Labels sugeridas:** `security`, `média`

## Problema
1. `.env.example` publica senhas e `ADMIN_ACCESS_KEY` previsíveis. O startup **exige** `ADMIN_PASSWORD`, mas **não rejeita** o valor de exemplo. `SESSION_SECRET` pode ser omitido e o código gera um arquivo local — na Vercel, se a env faltar, o comportamento é frágil.
2. A chave do painel vai na query `?k=` / `?acesso=` (histórico, Referer, logs). O servidor de desenvolvimento ainda imprime a chave no stdout.

`.env` e `data/` não entram no git (ponto forte). Não há chave de API de terceiro no bundle do frontend.

## Evidência
`.env.example:1-6` — `ADMIN_PASSWORD=escolha-uma-senha-forte`, `ADMIN_ACCESS_KEY=um-codigo-secreto-so-da-bia`
`lib/store.js:21-27` e `36-41` — secret opcional; senha só testa presença
`api/painel.js:38` — `url.searchParams.get("k")`
`server.mjs:61` — log com `ADMIN_ACCESS_KEY`

## Impacto
Quem copia o exemplo para produção (ou deixa a chave na URL) facilita login e descoberta do HTML do painel. A API de login **não** depende da chave `k`; a senha fraca é o risco maior.

## Sugestão de correção
- Recusar no boot senhas/chaves iguais às do `.env.example`
- Exigir `SESSION_SECRET` forte também na Vercel
- Trocar o gate `?k=` por POST / header / cookie sem query string
- Não logar a chave

## Critérios de aceite
- [ ] App recusa subir com `ADMIN_PASSWORD`/`ADMIN_ACCESS_KEY`/`SESSION_SECRET` iguais ao exemplo
- [ ] Painel não exige a chave na URL
- [ ] `server.mjs` não imprime o valor de `ADMIN_ACCESS_KEY`
- [ ] Histórico git continua sem `.env` real
""",
    },
    {
        "n": 4,
        "md": """# [Segurança] Perfil ins_alex editável por qualquer usuário staff

**Labels sugeridas:** `security`, `baixa`

## Problema
`isOwnInstructor` devolve verdadeiro se `instructor.id === "ins_alex"`, **sem** comparar com o usuário autenticado. Hoje só existe um staff (Alex), então o efeito prático é pequeno. Se no futuro houver outro instrutor com papel `staff`, ele poderá alterar o cadastro do Alex.

## Evidência
`lib/permissions.js:20-23`:
```
export function isOwnInstructor(instructor, user) {
  if (!instructor || !user) return false;
  if (String(instructor.id || "") === "ins_alex") return true;
  return String(instructor.name || "").trim().toLowerCase() === String(user.name || "").trim().toLowerCase();
}
```

## Impacto
Baixo no estado atual (um único staff). Vira falha de autorização se o time crescer.

## Sugestão de correção
Remover o atalho `ins_alex`. Autorizar só por `user.email` / id estável ligado ao instrutor, não por nome.

## Critérios de aceite
- [ ] Staff cuja conta não é a do Alex **não** altera o registro `ins_alex` no PUT
- [ ] Alex continua podendo editar o próprio perfil
- [ ] Perfil da Bia (`ins_bia`) permanece imutável para staff
""",
    },
]


def build():
    styles = make_styles()
    donut, bars = draw_charts()
    story = []

    story.append(Spacer(1, 38 * mm))
    story.append(Paragraph("AUDITORIA DE APLICAÇÃO WEB", styles["CoverKicker"]))
    story.append(
        Paragraph(
            "Relatório de Auditoria de Segurança — Pratique + Pilates",
            styles["CoverTitle"],
        )
    )
    story.append(Paragraph("Data: 14 de setembro de 2026", styles["CoverMeta"]))
    story.append(Paragraph("Projeto: <b>pratique-pilates</b> (kauanbg-dev/adm-pilates)", styles["CoverMeta"]))
    story.append(
        Paragraph(
            "Escopo: código da branch de trabalho (site público, painel admin, API em Vercel Functions / Node, persistência Neon JSONB ou arquivos locais).",
            styles["CoverMeta"],
        )
    )
    story.append(Spacer(1, 8 * mm))

    cover_box = [
        [
            Paragraph(
                "<b>Stack detectada</b><br/>Linguagem: JavaScript (ES modules) no Node.js.<br/>"
                "Framework HTTP: handler único em <font face='DejaVuMono'>api/index.js</font> (Vercel Serverless) + <font face='DejaVuMono'>server.mjs</font> local.<br/>"
                "ORM: nenhum. SQL via <font face='DejaVuMono'>@neondatabase/serverless</font> (tagged templates) ou JSON em <font face='DejaVuMono'>data/</font>.<br/>"
                "Auth: cookie HttpOnly HMAC-SHA256 (<font face='DejaVuMono'>pratique_session</font>), senhas PBKDF2; gate extra <font face='DejaVuMono'>ADMIN_ACCESS_KEY</font> só para o HTML do painel.<br/>"
                "Frontend: HTML/CSS/JS estático (<font face='DejaVuMono'>index.html</font>, <font face='DejaVuMono'>admin.html</font>).<br/>"
                "Deploy: <font face='DejaVuMono'>vercel.json</font>. Sem Docker, CI, Helm ou Terraform neste repositório.",
                styles["BodyLeft"],
            )
        ]
    ]
    t = Table(cover_box, colWidths=[17 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(PALETTE["mint"])),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor(PALETTE["teal"])),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 6 * mm))
    story.append(
        Paragraph(
            "<b>Nota metodológica.</b> Cada categoria pedida foi mapeada assim: "
            "(1) Isolamento de inquilino → documento único <font face='DejaVuMono'>studio</font> + filtro por papel, não RLS/Supabase. "
            "(2) Permissão no navegador → cruzamento de <font face='DejaVuMono'>isStaff()</font> no <font face='DejaVuMono'>js/admin.js</font> com <font face='DejaVuMono'>mergeStudioWrite</font> / rotas em <font face='DejaVuMono'>api/index.js</font>. "
            "(3) IDOR → inventário de todos os handlers (<font face='DejaVuMono'>/api/login</font>, <font face='DejaVuMono'>logout</font>, <font face='DejaVuMono'>me</font>, <font face='DejaVuMono'>GET/PUT /api/studio</font>, <font face='DejaVuMono'>/api/painel</font>); não há rotas <font face='DejaVuMono'>/:id</font>. "
            "(4) Chaves → código, <font face='DejaVuMono'>.env.example</font>, <font face='DejaVuMono'>vercel.json</font>, scripts, histórico git e JS do frontend. "
            "(5) XSS → <font face='DejaVuMono'>innerHTML</font> no painel, site público e respostas HTML da API. "
            "Só entram achados com arquivo e linha no código atual. Sem Docker/CI/Helm, esses arquivos não foram forçados.",
            styles["Body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("1. Resumo executivo", styles["H1"]))
    story.append(
        Paragraph(
            "Foram verificados os cinco eixos no código real. Há <b>6 achados</b>: nenhuma crítica, "
            "<b>2 altas</b> (autorização de escrita do staff e XSS armazenado), <b>2 médias</b> (segredos de exemplo e chave na URL), "
            "<b>1 baixa</b> e <b>1 informativa</b>. O modelo é de <b>um único estúdio</b>, não um SaaS multi-inquilino — "
            "IDOR clássico por ID de recurso <b>não se aplica</b> como rota HTTP.",
            styles["Body"],
        )
    )

    kpi_data = [[
        Paragraph("<para align='center'><b>0</b><br/>crítica</para>", styles["Cell"]),
        Paragraph("<para align='center'><b>2</b><br/>alta</para>", styles["Cell"]),
        Paragraph("<para align='center'><b>2</b><br/>média</para>", styles["Cell"]),
        Paragraph("<para align='center'><b>1</b><br/>baixa</para>", styles["Cell"]),
        Paragraph("<para align='center'><b>1</b><br/>informativa</para>", styles["Cell"]),
        Paragraph("<para align='center'><b>6</b><br/>total</para>", styles["CellBold"]),
    ]]
    kpi = Table(kpi_data, colWidths=[2.8 * cm] * 6)
    kpi.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#FEE2E2")),
                ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#FFEDD5")),
                ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#FEF3C7")),
                ("BACKGROUND", (3, 0), (3, 0), colors.HexColor("#DBEAFE")),
                ("BACKGROUND", (4, 0), (4, 0), colors.HexColor("#E2E8F0")),
                ("BACKGROUND", (5, 0), (5, 0), colors.HexColor(PALETTE["mint"])),
                ("BOX", (0, 0), (-1, -1), 0.3, colors.HexColor(PALETTE["line"])),
                ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor(PALETTE["line"])),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(kpi)
    story.append(Spacer(1, 6 * mm))

    img_row = Table(
        [[Image(str(donut), width=8.2 * cm, height=8.2 * cm), Image(str(bars), width=8.6 * cm, height=5.0 * cm)]],
        colWidths=[8.6 * cm, 8.6 * cm],
    )
    img_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (1, 0), (1, 0), "CENTER")]))
    story.append(img_row)

    story.append(Paragraph("2. Pontos fortes (o que está protegido)", styles["H1"]))
    fortes = [
        "<b>Sessão nas APIs de dados.</b> <font face='DejaVuMono'>GET/PUT /api/studio</font> e <font face='DejaVuMono'>/api/me</font> exigem cookie HMAC válido (<font face='DejaVuMono'>api/index.js:59-84</font>). Login compara hash com <font face='DejaVuMono'>timingSafeEqual</font> (<font face='DejaVuMono'>lib/auth.js:16-20</font>). Cookie HttpOnly + SameSite=Lax.",
        "<b>Financeiro do staff no servidor, não só na UI.</b> <font face='DejaVuMono'>studioForClient</font> zera <font face='DejaVuMono'>transactions</font> no GET (<font face='DejaVuMono'>lib/permissions.js:26-28</font>). O PUT restaura as transações atuais (<font face='DejaVuMono'>linhas 31-33</font>). Cruzado com <font face='DejaVuMono'>js/admin.js:337, 915-919, 1562+</font>.",
        "<b>Instrutores: dona imutável para staff.</b> <font face='DejaVuMono'>mergeStudioWrite</font> reescreve a lista a partir do estado anterior e congela o perfil da Bia (<font face='DejaVuMono'>lib/permissions.js:36-37</font>). Staff não cria nem apaga instrutores pelo PUT.",
        "<b>SQL parametrizado.</b> Neon tagged templates em <font face='DejaVuMono'>lib/store.js:76-105, 134, 144, 154</font> — sem concatenar e-mail/payload na query.",
        "<b>Sem IDOR por rota /:id.</b> Handlers existentes: login, logout, me, GET/PUT studio, painel HTML. Nenhum busca objeto por ID de path/query sem dono: o recurso é o documento único do estúdio.",
        "<b>Segredos reais fora do git.</b> <font face='DejaVuMono'>.gitignore</font> cobre <font face='DejaVuMono'>.env</font> e <font face='DejaVuMono'>data/</font>. Histórico sem <font face='DejaVuMono'>.env</font> commitado. JS do frontend sem API keys.",
        "<b>ADMIN_PASSWORD obrigatório.</b> <font face='DejaVuMono'>lib/store.js:36-41</font> aborta se a env estiver vazia. Painel HTML 404 se <font face='DejaVuMono'>ADMIN_ACCESS_KEY</font> não existir (<font face='DejaVuMono'>api/painel.js:15-36</font>).",
        "<b>Site público sem innerHTML de input.</b> <font face='DejaVuMono'>js/main.js</font> usa <font face='DejaVuMono'>textContent</font> no formulário. API não monta e-mail HTML.",
        "<b>Nomes de alunos escapados no painel.</b> <font face='DejaVuMono'>escapeHtml</font>/<font face='DejaVuMono'>escapeAttr</font> em nome, e-mail, notas, descrição financeira (<font face='DejaVuMono'>js/admin.js:1447-1456</font> e usos em 461, 499, 516, 958…).",
        "<b>Path traversal local bloqueado</b> para <font face='DejaVuMono'>data/</font>, <font face='DejaVuMono'>.env</font>, <font face='DejaVuMono'>.git</font>, <font face='DejaVuMono'>lib/</font> (<font face='DejaVuMono'>server.mjs:35-47</font>). Rewrites Vercel equivalentes em <font face='DejaVuMono'>vercel.json:10-11</font>.",
    ]
    story.append(
        ListFlowable(
            [ListItem(Paragraph(item, styles["BulletBody"]), leftIndent=12, bulletColor=colors.HexColor(PALETTE["forte"])) for item in fortes],
            bulletType="bullet",
            start="•",
            leftIndent=15,
            bulletFontName="DejaVu",
            bulletFontSize=9,
        )
    )

    story.append(Paragraph("3. Pontos fracos (riscos centrais)", styles["H1"]))
    fracos = [
        "A autorização fina (valor da aula, “só a Bia”) vive em grande parte no JavaScript do painel. O PUT copia o JSON do cliente.",
        "XSS armazenado: horários, status e IDs entram em <font face='DejaVuMono'>innerHTML</font> sem escape — um PUT autenticado executa script na sessão de quem abrir a agenda.",
        "A chave do painel viaja na query string; senhas de exemplo do repositório não são recusadas no boot.",
        "Não há multi-tenant: qualquer login válido vê (e, no caso staff, pode reescrever) o cadastro completo de alunos. Isso é o desenho do produto, mas o papel staff não é um isolamento de dados.",
    ]
    story.append(
        ListFlowable(
            [ListItem(Paragraph(item, styles["BulletBody"]), leftIndent=12) for item in fracos],
            bulletType="bullet",
            start="•",
            leftIndent=15,
        )
    )

    story.append(Paragraph("4. Achados detalhados por categoria", styles["H1"]))

    story.append(Paragraph("4.1 Isolamento de inquilino / dono", styles["H2"]))
    story.append(
        Paragraph(
            "<b>Mecanismo identificado:</b> não há RLS (não é Supabase) nem <font face='DejaVuMono'>tenant_id</font>. "
            "Há uma linha <font face='DejaVuMono'>studio.id = 1</font> (ou um <font face='DejaVuMono'>studio.json</font>). "
            "Isolamento = sessão autenticada + máscara por papel (<font face='DejaVuMono'>transactions</font>). "
            "Categoria multi-inquilino <b>não se aplica</b> como vazamento entre organizações.",
            styles["Body"],
        )
    )

    story.append(Paragraph("4.2 Permissão definida no navegador", styles["H2"]))
    story.append(
        Paragraph(
            "Cruzamento feito: financeiro, valor, novo instrutor, gerar cobranças, baixar/atrasar lançamento. "
            "Servidor cobre financeiro e lista de instrutores. <b>Não cobre</b> <font face='DejaVuMono'>classPrice</font>.",
            styles["Body"],
        )
    )

    story.append(Paragraph("4.3 IDOR", styles["H2"]))
    story.append(
        Paragraph(
            "Percorridos todos os handlers. Não existem rotas que leiam/alterem/deletem por ID de path, query ou body isolado. "
            "O PUT substitui o documento. Posse verificada só em transações (imutáveis para staff) e instrutores (merge). "
            "<b>Nenhum achado clássico de IDOR.</b> A reescrita ampla do JSON pelo staff está na categoria 2.",
            styles["Body"],
        )
    )

    story.append(Paragraph("4.4 Chaves expostas", styles["H2"]))
    story.append(
        Paragraph(
            "Sem Docker/CI/Helm/Terraform. Bundle frontend sem tokens. Histórico git: apenas placeholders em <font face='DejaVuMono'>.env.example</font> (commit 2f9d0a5).",
            styles["Body"],
        )
    )

    story.append(Paragraph("4.5 Inputs sem tratamento (XSS)", styles["H2"]))
    story.append(
        Paragraph(
            "Há helper de escape, mas a cobertura é irregular. Backend não interpola input em HTML de e-mail. Site público OK.",
            styles["Body"],
        )
    )

    findings = [
        ("informativa", PALETTE["informativa"], "Isolamento", "lib/store.js:141-148; api/index.js:69-76; lib/permissions.js:26-28",
         "GET /api/studio devolve o estúdio inteiro a qualquer login. Staff só perde transactions. Não há filtro por instrutor. Explorável como leitura de PII de todos os alunos por qualquer conta staff — alinhado ao produto de estúdio único, por isso informativo."),
        ("alta", PALETTE["alta"], "Permissão", "lib/permissions.js:31-48; api/index.js:79-93; js/admin.js:342, 1101-1102, 164-166",
         "Staff não vê “Alterar valor”, mas o PUT grava classPrice e o restante do JSON (exceto transações/instrutores). Condição: sessão staff válida. PoC: PUT com classPrice: 0."),
        ("baixa", PALETTE["baixa"], "Permissão", "lib/permissions.js:20-23",
         "isOwnInstructor retorna true para id ins_alex sem checar o usuário. Hoje só há um staff; vira buraco se existir outro."),
        ("média", PALETTE["media"], "Chaves", ".env.example:1-6; lib/store.js:21-27 e 36-41",
         "Placeholders públicos (escolha-uma-senha-forte, um-codigo-secreto-so-da-bia). Boot não rejeita esses valores. SESSION_SECRET pode faltar e cair em arquivo gerado."),
        ("média", PALETTE["media"], "Chaves", "api/painel.js:38-40; server.mjs:61",
         "ADMIN_ACCESS_KEY na query ?k= (histórico, Referer, logs) e impressa no stdout do dev server. A API de login não usa essa chave — o risco combina com senha fraca."),
        ("alta", PALETTE["alta"], "XSS", "js/admin.js:266, 407, 466, 663, 713-714, 741, 751, 753, 758, 1293, 1612-1613, 1681",
         "innerHTML com time/status/id/modalidade/data crus. Não há DOMPurify. Condição: atacante autenticado grava o payload; a vítima (ex.: admin) abre a agenda. Cookie HttpOnly não impede fetch com credentials."),
    ]

    header = [
        Paragraph("<b>Sev.</b>", styles["CellBold"]),
        Paragraph("<b>Cat.</b>", styles["CellBold"]),
        Paragraph("<b>Arquivo:linha</b>", styles["CellBold"]),
        Paragraph("<b>Descrição</b>", styles["CellBold"]),
    ]
    rows = [header]
    bg_map = {
        "alta": "#FFEDD5",
        "média": "#FEF3C7",
        "baixa": "#DBEAFE",
        "informativa": "#F1F5F9",
    }
    for sev, color, cat, loc, desc in findings:
        rows.append(
            [
                chip(sev, styles, color),
                Paragraph(xml(cat), styles["Cell"]),
                Paragraph(xml(loc), styles["Cell"]),
                Paragraph(xml(desc), styles["Cell"]),
            ]
        )
    table = Table(rows, colWidths=[2.5 * cm, 2.4 * cm, 4.4 * cm, 7.7 * cm], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(PALETTE["teal"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor(PALETTE["teal"])),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor(PALETTE["line"])),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(PALETTE["teal"])),
    ]
    for i, (sev, *_) in enumerate(findings, start=1):
        style_cmds.append(("BACKGROUND", (1, i), (-1, i), colors.HexColor(bg_map[sev])))
    table.setStyle(TableStyle(style_cmds))
    # header text white - CellBold is dark; fix header row by using white paragraphs
    header_white = ParagraphStyle("HdrW", parent=styles["CellBold"], textColor=colors.white)
    rows[0] = [
        Paragraph("<b>Sev.</b>", header_white),
        Paragraph("<b>Cat.</b>", header_white),
        Paragraph("<b>Arquivo:linha</b>", header_white),
        Paragraph("<b>Descrição</b>", header_white),
    ]
    table = Table(rows, colWidths=[2.5 * cm, 2.4 * cm, 4.4 * cm, 7.7 * cm], repeatRows=1)
    table.setStyle(TableStyle(style_cmds))
    story.append(table)

    story.append(Paragraph("4.6 Trechos citados", styles["H2"]))
    snippets = [
        ("lib/permissions.js:31-33 — merge não filtra classPrice",
         "export function mergeStudioWrite(incoming, current, user) {\n"
         "  if (isAdmin(user) || !incoming || typeof incoming !== \"object\") return incoming;\n"
         "  const next = { ...incoming, transactions: current.transactions || [] };"),
        ("js/admin.js:266 — status sem escape",
         "return `<span class=\"chip ${map[status] || \"\"}\">${labels[status] || status}</span>`;"),
        ("api/painel.js:38-40 — chave na query",
         "const offered = url.searchParams.get(\"k\") || url.searchParams.get(\"acesso\") || \"\";\n"
         "const allowed = secretsEqual(offered, key) || readGate(token, sessionSecret(), key);"),
        ("server.mjs:61 — chave no log",
         "console.log(`Painel: http://127.0.0.1:${port}/admin.html?k=${process.env.ADMIN_ACCESS_KEY || \"(veja data/access.key)\"}`);"),
    ]
    for title, code in snippets:
        story.append(Paragraph(title, styles["Small"]))
        story.append(Preformatted(code, styles["CodeBlock"]))

    story.append(Paragraph("5. Recomendações priorizadas", styles["H1"]))
    recs = [
        "<b>P1 — Autorização no PUT.</b> Allowlist por papel. Recusar alteração de classPrice (e outros campos só-admin) para staff. Teste de regressão com conta Alex.",
        "<b>P1 — XSS.</b> Escapar todos os interpolados; validar time/status/id no servidor. Tratar innerHTML como lista de verificação, não exceção.",
        "<b>P2 — Segredos.</b> Recusar placeholders no boot; exigir SESSION_SECRET; tirar a chave da query e do log.",
        "<b>P3 — isOwnInstructor.</b> Ligar o perfil ao usuário autenticado, sem atalho ins_alex.",
        "<b>P3 — Endurecimento.</b> Rate limit no /api/login; Secure cookie sempre em produção; não devolver err.message cru no 500 (<font face='DejaVuMono'>api/index.js:98</font> — observado, fora das cinco categorias).",
    ]
    story.append(
        ListFlowable(
            [ListItem(Paragraph(item, styles["BulletBody"]), leftIndent=12) for item in recs],
            bulletType="bullet",
            start="•",
            leftIndent=15,
        )
    )

    story.append(Paragraph("6. Cobertura da auditoria (o que foi visto e está correto)", styles["H1"]))
    story.append(
        Paragraph(
            "Handlers: POST /api/login, POST /api/logout, GET /api/me, GET /api/studio, PUT /api/studio, GET /api/painel (admin.html). "
            "Wrappers api/login.js, me.js, logout.js, studio.js só reexportam o handler. "
            "Frontend público (index.html + js/main.js) sem innerHTML de dados. "
            "Sem Dockerfile, .github/workflows, Helm ou Terraform — categoria de secrets nesses arquivos: não aplicável. "
            "Lib de sanitização: inexistente; o equivalente local é escapeHtml, aplicado em nomes/contatos e omitido em horários/status/IDs.",
            styles["Body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("ISSUES PARA O GITHUB", styles["H1"]))
    story.append(
        Paragraph(
            "Blocos prontos para colar. Achados triviais do mesmo tema (placeholders + chave na URL) foram agrupados na issue 3. "
            "O achado informativo de estúdio único não vira issue.",
            styles["Body"],
        )
    )

    for issue in ISSUES:
        body = xml(issue["md"]).replace("\n", "<br/>")
        block = [
            Paragraph(f"--- ISSUE {issue['n']} ---", styles["IssueTitle"]),
            Paragraph(body, styles["IssueBody"]),
            Paragraph(f"--- FIM ISSUE {issue['n']} ---", styles["IssueTitle"]),
        ]
        box = Table([[block[0]], [block[1]], [block[2]]], colWidths=[17 * cm])
        box.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                    ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor(PALETTE["teal"])),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(PALETTE["mint"])),
                    ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor(PALETTE["mint"])),
                ]
            )
        )
        story.append(KeepTogether([box, Spacer(1, 4 * mm)]))

    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=22 * mm,
        bottomMargin=20 * mm,
        title="Relatório de Auditoria de Segurança — Pratique + Pilates",
        author="Auditoria pontual — Cursor",
    )
    doc.build(story, onFirstPage=cover_header_footer, onLaterPages=header_footer)
    return PDF_PATH


if __name__ == "__main__":
    path = build()
    print(path)
