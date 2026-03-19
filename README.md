# ⛅ Atmosfera — Site de Clima

Site de previsão do tempo em tempo real com consumo de API externa,
arquivos totalmente separados (HTML · CSS · JS · JSON).

## 📁 Estrutura do projeto

```
atmosfera/
├── index.html          ← Estrutura HTML semântica
├── css/
│   └── style.css       ← Todo o visual (design system, animações)
├── js/
│   ├── particles.js    ← Sistema de partículas canvas (chuva, neve, estrelas...)
│   ├── weather.js      ← Comunicação com APIs externas + cache em memória
│   ├── ui.js           ← Renderização do DOM (cards, métricas, horária, semanal)
│   └── app.js          ← Controlador principal (carrega JSON, orquestra tudo)
└── data/
    └── data.json       ← Base de dados local: cidades, códigos WMO, config...
```

## 🗂️ O papel do data.json

O `data.json` centraliza toda a configuração e dados estáticos:

| Campo             | O que contém                                          |
|-------------------|-------------------------------------------------------|
| `config`          | Unidade padrão, TTL do cache, número de dias          |
| `quick_cities`    | 12 cidades populares com coords, país e bandeira      |
| `wmo_codes`       | Mapa código WMO → ícone emoji + descrição + tipo      |
| `wind_directions` | 16 direções do vento (N, NNE, NE...)                  |
| `uv_levels`       | Faixas de UV com label e cor                          |
| `visibility_levels` | Faixas de visibilidade com label                    |
| `pressure_levels` | Faixas de pressão com label                           |
| `backgrounds`     | Gradientes CSS por condição climática                 |
| `days_pt`         | Nomes dos dias em português                           |
| `messages`        | Textos de erro e status da UI                         |

## 🌐 APIs externas (gratuitas, sem chave)

| API | Uso |
|-----|-----|
| [Open-Meteo](https://open-meteo.com) | Dados meteorológicos (clima atual, horário, 7 dias) |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | Busca de cidades por nome |
| [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org) | Geocodificação reversa (coords → cidade) |

## 🚀 Como rodar

### Opção 1 — Live Server (recomendado para desenvolvimento)

```bash
# VS Code: instale a extensão "Live Server" e clique em "Go Live"
# Ou use o npx:
npx serve .
```

### Opção 2 — Python (sem instalar nada)

```bash
# Python 3
python3 -m http.server 3000

# Python 2
python -m SimpleHTTPServer 3000
```

Acesse: **http://localhost:3000**

> ⚠️ **Não abra o index.html diretamente** pelo sistema de arquivos (`file://`).
> O fetch do `data.json` requer um servidor HTTP local.

## ✨ Funcionalidades

- 🔍 Busca de cidades com **autocomplete em tempo real**
- 📍 **Geolocalização** do dispositivo
- 🌡️ Temperatura atual com alternância **°C / °F**
- 📊 **8 métricas**: umidade, vento, pressão, UV, visibilidade, chuva, nascer/pôr do sol
- ⏱️ **Previsão de 24 horas** rolável
- 📅 **Previsão de 7 dias** com barras de min/max
- 🎨 **Fundo dinâmico** com gradiente + partículas conforme o clima
- ⚡ **Cache em memória** (evita requisições repetidas por 10 min)

## 🎨 Design

- Estética brutalismo suave + dark mode + neon frio
- Fontes: **Syne** (display) + **Fira Code** (mono)
- Sistema de partículas canvas: estrelas, chuva, neve, tempestade, névoa
- Fundo responsivo ao clima: 10 gradientes distintos
- 100% responsivo (mobile-first)# Check-de-clima
