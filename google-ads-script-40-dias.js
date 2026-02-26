// =====================================================
// CONFIGURACAO - ALTERE ESTES VALORES
// =====================================================
var TARGET_ACCOUNT_ID = '636-075-3747';
var DAYS_TO_FETCH = 40;
var WEBHOOK_URL = 'https://iixeygzkgfwetchjvpvo.supabase.co/functions/v1/webhook-google-ads';
var TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeGV5Z3prZ2Z3ZXRjaGp2cHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MDc5NjMsImV4cCI6MjA3MTE4Mzk2M30.gWKk7Q1L_9Ci4j1AF05Di_ST6ZMF2F5l6zvoyKh_VMc';

function main() {
  // 1. SELECIONAR A CONTA
  var accountId, accountName, timeZone;

  // Tenta usar AdsApp.accounts() (conta MCC)
  try {
    var accountIterator = AdsApp.accounts()
      .withCondition('customer_id = "' + TARGET_ACCOUNT_ID + '"')
      .get();

    if (accountIterator.hasNext()) {
      var account = accountIterator.next();
      AdsApp.select(account);
      accountId = account.getCustomerId();
      accountName = account.getName();
      timeZone = account.getTimeZone();
      Logger.log('Conta MCC selecionada: ' + accountName + ' (' + accountId + ')');
    } else {
      Logger.log('ERRO: Conta ' + TARGET_ACCOUNT_ID + ' nao encontrada no MCC!');
      return;
    }
  } catch (e) {
    // Nao e MCC, usa a conta atual diretamente
    var currentAccount = AdsApp.currentAccount();
    accountId = currentAccount.getCustomerId();
    accountName = currentAccount.getName();
    timeZone = currentAccount.getTimeZone();
    Logger.log('Conta individual: ' + accountName + ' (' + accountId + ')');
  }

  // 2. CONFIGURAR PERIODO (40 DIAS)
  var today = new Date();
  var dateEnd = Utilities.formatDate(today, timeZone, 'yyyy-MM-dd');

  var pastDate = new Date();
  pastDate.setDate(today.getDate() - DAYS_TO_FETCH);
  var dateStart = Utilities.formatDate(pastDate, timeZone, 'yyyy-MM-dd');

  Logger.log('Buscando dados de: ' + dateStart + ' ate ' + dateEnd);

  // 3. BUSCAR CAMPANHAS AGRUPADAS POR DATA
  var campaignQuery = '' +
    'SELECT ' +
    '  segments.date, ' +
    '  campaign.id, ' +
    '  campaign.name, ' +
    '  campaign.status, ' +
    '  campaign.advertising_channel_type, ' +
    '  metrics.average_cpc, ' +
    '  metrics.ctr, ' +
    '  metrics.conversions, ' +
    '  metrics.clicks, ' +
    '  metrics.cost_micros, ' +
    '  metrics.impressions ' +
    'FROM campaign ' +
    'WHERE campaign.advertising_channel_type IN ("SEARCH", "PERFORMANCE_MAX") ' +
    '  AND segments.date BETWEEN "' + dateStart + '" AND "' + dateEnd + '" ' +
    'ORDER BY segments.date ASC';

  var campaignIterator = AdsApp.search(campaignQuery);
  var dataByDate = {};

  while (campaignIterator.hasNext()) {
    var row = campaignIterator.next();
    var date = row.segments.date;
    var campaignId = row.campaign.id;

    if (!dataByDate[date]) {
      dataByDate[date] = {};
    }

    dataByDate[date][campaignId] = {
      accountId: accountId,
      accountName: accountName,
      campaignId: campaignId,
      name: row.campaign.name,
      isEnabled: row.campaign.status === 'ENABLED',
      type: row.campaign.advertisingChannelType,
      date: date,
      stats: {
        averageCpc: parseFloat(row.metrics.averageCpc) || 0,
        ctr: parseFloat(row.metrics.ctr) || 0,
        conversions: parseInt(row.metrics.conversions) || 0,
        clicks: parseInt(row.metrics.clicks) || 0,
        cost: parseFloat(row.metrics.costMicros) / 1000000 || 0,
        impressions: parseInt(row.metrics.impressions) || 0
      },
      adGroups: {}
    };
  }

  Logger.log('Campanhas encontradas para ' + Object.keys(dataByDate).length + ' dias');

  // 4. BUSCAR AD GROUPS (agrupados por data)
  var adGroupQuery = '' +
    'SELECT ' +
    '  segments.date, ' +
    '  campaign.id, ' +
    '  ad_group.id, ' +
    '  ad_group.name, ' +
    '  ad_group.status, ' +
    '  metrics.clicks, ' +
    '  metrics.conversions, ' +
    '  metrics.cost_micros, ' +
    '  metrics.impressions ' +
    'FROM ad_group ' +
    'WHERE segments.date BETWEEN "' + dateStart + '" AND "' + dateEnd + '" ' +
    '  AND campaign.status = "ENABLED" ' +
    '  AND ad_group.status = "ENABLED"';

  var adGroupIterator = AdsApp.search(adGroupQuery);

  while (adGroupIterator.hasNext()) {
    var row = adGroupIterator.next();
    var date = row.segments.date;
    var campaignId = row.campaign.id;
    var adGroupId = row.adGroup.id;

    if (dataByDate[date] && dataByDate[date][campaignId]) {
      dataByDate[date][campaignId].adGroups[adGroupId] = {
        adGroupId: adGroupId,
        name: row.adGroup.name,
        status: row.adGroup.status,
        stats: {
          clicks: parseInt(row.metrics.clicks) || 0,
          conversions: parseInt(row.metrics.conversions) || 0,
          cost: parseFloat(row.metrics.costMicros) / 1000000 || 0,
          impressions: parseInt(row.metrics.impressions) || 0
        },
        keywords: []
      };
    }
  }

  // 5. BUSCAR KEYWORDS (agrupadas por data e ad group)
  var keywordQuery = '' +
    'SELECT ' +
    '  segments.date, ' +
    '  campaign.id, ' +
    '  ad_group.id, ' +
    '  ad_group_criterion.criterion_id, ' +
    '  ad_group_criterion.keyword.text, ' +
    '  ad_group_criterion.keyword.match_type, ' +
    '  metrics.clicks, ' +
    '  metrics.conversions, ' +
    '  metrics.cost_micros ' +
    'FROM keyword_view ' +
    'WHERE segments.date BETWEEN "' + dateStart + '" AND "' + dateEnd + '" ' +
    '  AND ad_group_criterion.status = "ENABLED" ' +
    '  AND campaign.status = "ENABLED"';

  var keywordIterator = AdsApp.search(keywordQuery);

  while (keywordIterator.hasNext()) {
    var row = keywordIterator.next();
    var date = row.segments.date;
    var campaignId = row.campaign.id;
    var adGroupId = row.adGroup.id;

    if (dataByDate[date] &&
        dataByDate[date][campaignId] &&
        dataByDate[date][campaignId].adGroups[adGroupId]) {
      dataByDate[date][campaignId].adGroups[adGroupId].keywords.push({
        keywordId: row.adGroupCriterion.criterionId,
        keyword: row.adGroupCriterion.keyword.text,
        matchType: row.adGroupCriterion.keyword.matchType,
        clicks: parseInt(row.metrics.clicks) || 0,
        conversions: parseInt(row.metrics.conversions) || 0,
        cost: parseFloat(row.metrics.costMicros) / 1000000 || 0,
        searchTerms: []
      });
    }
  }

  // 6. BUSCAR SEARCH TERMS (agrupados por data)
  var searchTermQuery = '' +
    'SELECT ' +
    '  segments.date, ' +
    '  campaign.id, ' +
    '  ad_group.id, ' +
    '  search_term_view.search_term, ' +
    '  segments.keyword.ad_group_criterion, ' +
    '  metrics.clicks, ' +
    '  metrics.conversions, ' +
    '  metrics.cost_micros ' +
    'FROM search_term_view ' +
    'WHERE segments.date BETWEEN "' + dateStart + '" AND "' + dateEnd + '" ' +
    '  AND campaign.status = "ENABLED"';

  var termIterator = AdsApp.search(searchTermQuery);

  while (termIterator.hasNext()) {
    var row = termIterator.next();
    var date = row.segments.date;
    var campaignId = row.campaign.id;
    var adGroupId = row.adGroup.id;

    if (dataByDate[date] &&
        dataByDate[date][campaignId] &&
        dataByDate[date][campaignId].adGroups[adGroupId]) {

      var keywordIdClean = null;
      var kwIdRaw = row.segments.keyword ? row.segments.keyword.adGroupCriterion : null;
      if (kwIdRaw && kwIdRaw.indexOf('~') > -1) {
        keywordIdClean = kwIdRaw.split('~')[1];
      }

      // Encontrar a keyword correspondente e adicionar o search term
      var keywords = dataByDate[date][campaignId].adGroups[adGroupId].keywords;
      for (var k = 0; k < keywords.length; k++) {
        // FIX: Comparar como strings para evitar problema de tipo
        var kwIdStr = String(keywords[k].keywordId);
        var stKwIdStr = String(keywordIdClean);

        if (kwIdStr === stKwIdStr || keywordIdClean === null) {
          keywords[k].searchTerms.push({
            term: row.searchTermView.searchTerm,
            keywordId: keywordIdClean,
            clicks: parseInt(row.metrics.clicks) || 0,
            conversions: parseInt(row.metrics.conversions) || 0,
            cost: parseFloat(row.metrics.costMicros) / 1000000 || 0
          });
          break;
        }
      }
    }
  }

  // 7. PROCESSAR E ENVIAR (por dia)
  var allDates = Object.keys(dataByDate).sort();
  var totalSent = 0;
  var totalFacts = 0;

  for (var i = 0; i < allDates.length; i++) {
    var date = allDates[i];
    var campaignsForDate = [];

    for (var campaignId in dataByDate[date]) {
      var camp = dataByDate[date][campaignId];

      // Converter adGroups de objeto para array e limitar keywords/search terms
      var adGroupsArray = [];
      for (var adGroupId in camp.adGroups) {
        var ag = camp.adGroups[adGroupId];

        // Limitar Top 5 keywords por ad group
        ag.keywords.sort(function(a, b) { return b.clicks - a.clicks; });
        ag.keywords = ag.keywords.slice(0, 5);

        // Limitar Top 5 search terms por keyword
        for (var k = 0; k < ag.keywords.length; k++) {
          ag.keywords[k].searchTerms.sort(function(a, b) { return b.clicks - a.clicks; });
          ag.keywords[k].searchTerms = ag.keywords[k].searchTerms.slice(0, 5);
        }

        adGroupsArray.push(ag);
      }

      // Ordenar ad groups por custo
      adGroupsArray.sort(function(a, b) { return b.stats.cost - a.stats.cost; });

      campaignsForDate.push({
        accountId: camp.accountId,
        accountName: camp.accountName,
        campaignId: camp.campaignId,
        name: camp.name,
        isEnabled: camp.isEnabled,
        type: camp.type,
        date: camp.date,
        stats: camp.stats,
        adGroups: adGroupsArray
      });
    }

    // Enviar dados desse dia especifico
    var payload = {
      date: date,
      campaigns: campaignsForDate
    };

    var result = sendToWebhook(payload);

    if (result.success) {
      totalSent++;
      totalFacts += campaignsForDate.length;
      Logger.log('OK ' + date + ': ' + campaignsForDate.length + ' campanhas enviadas');
    } else {
      Logger.log('ERRO ' + date + ': ' + result.error);
    }

    Utilities.sleep(100);
  }

  Logger.log('');
  Logger.log('========== RESUMO ==========');
  Logger.log('Total de dias processados: ' + totalSent);
  Logger.log('Total de fatos enviados: ' + totalFacts);
}

// FUNCAO AUXILIAR: Enviar para Webhook
function sendToWebhook(payload) {
  var options = {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    var responseCode = response.getResponseCode();

    if (responseCode >= 200 && responseCode < 300) {
      return { success: true };
    } else {
      return {
        success: false,
        error: 'HTTP ' + responseCode + ': ' + response.getContentText()
      };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}
