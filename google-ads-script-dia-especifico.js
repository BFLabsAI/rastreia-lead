// =====================================================
// SCRIPT PARA BUSCAR DADOS DE UM DIA ESPECIFICO
// Use quando um dia falhar devido a erro temporario
// =====================================================
var TARGET_ACCOUNT_ID = '636-075-3747'; // Altere para cada cliente
var WEBHOOK_URL = 'https://iixeygzkgfwetchjvpvo.supabase.co/functions/v1/webhook-google-ads';
var TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeGV5Z3prZ2Z3ZXRjaGp2cHZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2MDc5NjMsImV4cCI6MjA3MTE4Mzk2M30.gWKk7Q1L_9Ci4j1AF05Di_ST6ZMF2F5l6zvoyKh_VMc';

// =====================================================
// ALTERE ESTA DATA PARA O DIA QUE FALHOU
// =====================================================
var TARGET_DATE = '2026-02-13'; // Data que falhou

function main() {
  // 1. SELECIONAR A CONTA
  var accountId, accountName, timeZone;

  if (TARGET_ACCOUNT_ID && TARGET_ACCOUNT_ID !== '') {
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
      var currentAccount = AdsApp.currentAccount();
      accountId = currentAccount.getCustomerId();
      accountName = currentAccount.getName();
      timeZone = currentAccount.getTimeZone();
      Logger.log('Conta individual: ' + accountName + ' (' + accountId + ')');
    }
  } else {
    var currentAccount = AdsApp.currentAccount();
    accountId = currentAccount.getCustomerId();
    accountName = currentAccount.getName();
    timeZone = currentAccount.getTimeZone();
    Logger.log('Conta: ' + accountName + ' (' + accountId + ')');
  }

  Logger.log('========================================');
  Logger.log('BUSCANDO DADOS DO DIA: ' + TARGET_DATE);
  Logger.log('========================================');

  // 2. BUSCAR CAMPANHAS DO DIA ESPECIFICO
  var campaignQuery = '' +
    'SELECT ' +
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
    '  AND segments.date = "' + TARGET_DATE + '"';

  var campaignIterator = AdsApp.search(campaignQuery);
  var campaignMap = {};

  while (campaignIterator.hasNext()) {
    var row = campaignIterator.next();
    var campaignId = row.campaign.id;

    campaignMap[campaignId] = {
      accountId: accountId,
      accountName: accountName,
      campaignId: campaignId,
      name: row.campaign.name,
      isEnabled: row.campaign.status === 'ENABLED',
      type: row.campaign.advertisingChannelType,
      date: TARGET_DATE,
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

  Logger.log('Campanhas encontradas: ' + Object.keys(campaignMap).length);

  // 3. BUSCAR AD GROUPS
  var adGroupQuery = '' +
    'SELECT ' +
    '  campaign.id, ' +
    '  ad_group.id, ' +
    '  ad_group.name, ' +
    '  ad_group.status, ' +
    '  metrics.clicks, ' +
    '  metrics.conversions, ' +
    '  metrics.cost_micros, ' +
    '  metrics.impressions ' +
    'FROM ad_group ' +
    'WHERE segments.date = "' + TARGET_DATE + '" ' +
    '  AND campaign.status = "ENABLED" ' +
    '  AND ad_group.status = "ENABLED"';

  var adGroupIterator = AdsApp.search(adGroupQuery);

  while (adGroupIterator.hasNext()) {
    var row = adGroupIterator.next();
    var campaignId = row.campaign.id;
    var adGroupId = row.adGroup.id;

    if (campaignMap[campaignId]) {
      campaignMap[campaignId].adGroups[adGroupId] = {
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

  // 4. BUSCAR KEYWORDS
  var keywordQuery = '' +
    'SELECT ' +
    '  campaign.id, ' +
    '  ad_group.id, ' +
    '  ad_group_criterion.criterion_id, ' +
    '  ad_group_criterion.keyword.text, ' +
    '  ad_group_criterion.keyword.match_type, ' +
    '  metrics.clicks, ' +
    '  metrics.conversions, ' +
    '  metrics.cost_micros ' +
    'FROM keyword_view ' +
    'WHERE segments.date = "' + TARGET_DATE + '" ' +
    '  AND campaign.status = "ENABLED" ' +
    '  AND ad_group_criterion.status = "ENABLED"';

  var keywordIterator = AdsApp.search(keywordQuery);

  while (keywordIterator.hasNext()) {
    var row = keywordIterator.next();
    var campaignId = row.campaign.id;
    var adGroupId = row.adGroup.id;

    if (campaignMap[campaignId] && campaignMap[campaignId].adGroups[adGroupId]) {
      campaignMap[campaignId].adGroups[adGroupId].keywords.push({
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

  // 5. BUSCAR SEARCH TERMS
  var searchTermQuery = '' +
    'SELECT ' +
    '  campaign.id, ' +
    '  ad_group.id, ' +
    '  search_term_view.search_term, ' +
    '  segments.keyword.ad_group_criterion, ' +
    '  metrics.clicks, ' +
    '  metrics.conversions, ' +
    '  metrics.cost_micros ' +
    'FROM search_term_view ' +
    'WHERE segments.date = "' + TARGET_DATE + '" ' +
    '  AND campaign.status = "ENABLED"';

  var termIterator = AdsApp.search(searchTermQuery);

  while (termIterator.hasNext()) {
    var row = termIterator.next();
    var campaignId = row.campaign.id;
    var adGroupId = row.adGroup.id;

    if (campaignMap[campaignId] && campaignMap[campaignId].adGroups[adGroupId]) {
      var keywordIdClean = null;
      var kwIdRaw = row.segments.keyword ? row.segments.keyword.adGroupCriterion : null;
      if (kwIdRaw && kwIdRaw.indexOf('~') > -1) {
        keywordIdClean = kwIdRaw.split('~')[1];
      }

      var keywords = campaignMap[campaignId].adGroups[adGroupId].keywords;
      for (var k = 0; k < keywords.length; k++) {
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

  // 6. PREPARAR ARRAY FINAL
  var campaignDataArray = [];
  for (var campaignId in campaignMap) {
    var camp = campaignMap[campaignId];

    var adGroupsArray = [];
    for (var adGroupId in camp.adGroups) {
      var ag = camp.adGroups[adGroupId];

      ag.keywords.sort(function(a, b) { return b.clicks - a.clicks; });
      ag.keywords = ag.keywords.slice(0, 5);

      for (var k = 0; k < ag.keywords.length; k++) {
        ag.keywords[k].searchTerms.sort(function(a, b) { return b.clicks - a.clicks; });
        ag.keywords[k].searchTerms = ag.keywords[k].searchTerms.slice(0, 5);
      }

      adGroupsArray.push(ag);
    }

    adGroupsArray.sort(function(a, b) { return b.stats.cost - a.stats.cost; });

    campaignDataArray.push({
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

  // 7. ENVIAR PARA WEBHOOK
  var payload = {
    date: TARGET_DATE,
    campaigns: campaignDataArray
  };

  var result = sendToWebhook(payload);

  if (result.success) {
    Logger.log('========================================');
    Logger.log('SUCESSO! ' + campaignDataArray.length + ' campanhas enviadas para ' + TARGET_DATE);
    Logger.log('========================================');
  } else {
    Logger.log('ERRO: ' + result.error);
  }
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
