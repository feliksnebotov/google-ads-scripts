/**
 *
 * Campaign Budget Overspend Monitoring
 *
 * Этот скрипт отмечает ярлыками кампании, которые перетратили свой дневной бюджет.
 * Опционально, он также может выключать эти кампании, если они потратили слишком много.
 * Вам придет оповещение на почту, если будут новые отмеченные ярлыком кампании.
 * Когда бюджет более не перерасходуется, кампании возобновятся и ярлыки удалятся.
 *
 * Version: 1.0
 * Google AdWords Script maintained on brainlabsdigital.com
 * Original version - https://gist.github.com/BrainlabsDigital/2c1867781433e7163a035c16c2e4c760
 *
 * Version: 1.1
 * Added shared budgets
 **/

//////////////////////////////////////////////////////////////////////////////
// Настройки

var campaignNameContains = [];
// Используйте эту настройку если хотите выбрать некоторые кампании.
// Для примера ["Generic"] будут браться только кампании, которые содержать 'generic' в названии,
// Для ["Generic", "Competitor"] будет брать кампании где присутствуют значения 'generic' или 'competitor'.
// Оставьте значени [] чтобы обрабатывать все кампании.

var campaignNameDoesNotContain = ["brend"];
// Используйте эту настройку если хотите исключить некоторые кампании.
// Для примера ["Brand"] будет игнорировать все кампании, которые содержат 'brand' в имени,
// Для ["Brand", "Key Terms"] будет игнорировать все кампании, которые содержат 'brand' или
// 'key terms' в имени.
// Оставьте значени [] чтобы не исключать кампании.

var email = ["test1@media108.ru", "test2@media108.ru"];
// The email address you want the hourly update to be sent to.
// Адрес электронной почты для ежечасного получения обновлений.
// If you'd like to send to multiple addresses then have them separated by commas,
// Если вы хотите отправлять уведомления на несколько адресов, добавьте их через запятую.
// Пример ["aa@example.com", "bb@example.com"]

var currencySymbol = "₽";
// Используется для форматирования в письме.

var thousandsSeparator = "";
// Числа будут форматироваться через этот знак - разделитель для тысяч.
// Если использовать ",", 1000 будет иметь вид в письме 1,000
// Если использовать ".", 1000 будет иметь вид в письме 1.000
// Если использовать "" 1000 1000 будет иметь вид 1000.

var decimalMark = ",";
// Числа будут форматироваться через этот знак - десятичный разделитель
// Если использовать ".", полтора будет иметь вид в письме 1.5
// Если так "," то будет 1,5

var labelThreshold = 1.0;
// Это коэффициент для дневного бюджета кампаний, чтобы создать порог бюджета.
// Если расход кампании за день выше чем порог бюджета, то она будет помечена ярлыком
// (а вы получите письмо с уведомлением).
// Для примера если labelThreshold = 1.0, то кампании будут отмечены когда
// их расход будет больше или равен их дневному бюджету.

var labelName = "Over Budget";
// Имя ярлыка, который будет применяться к кампания с перерасходом

var campaignPauser = true;
// Измените значение на true, чтобы останавливать кампании, если их расход достигнет порог бюджета.
// Поставьте значение false, если кампании должны оставться включенными.

var pauseThreshold = 1.0;
// Это коэффициент для дневного бюджета кампаний, чтобы создать порог бюджета для остановки кампаний.
// Если значение в campaignPauser будет true и расход кампании будет больше данного лимита,
// кампания будет остановлена (и вы получите уведомление на почту).
// Для примера если pauseThreshold = 1.2 то камапнии будут остановлены когда
// их расход бдует равен или больше чем 120% от их дневного бюджета.
// pauseThreshold ДОЛЖЕН быть больше или равне labelThreshold,
// чтобы кампании, которы остановленные скриптом, также были отмечены ярлыком.


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
// Функции

function main() {
  checkInputs();

  //Получаем идентификаторы кампаний (на основе campaignNameDoesNotContain и campaignNameContains)
  var campaignData = getCampaignIds();
  var sharedBudgets = sharedBudgetData();
  Logger.log(sharedBudgets);

  var campaignsToAddLabel = [];
  var campaignsToRemoveLabel = [];
  var campaignsToPause = [];
  var campaignsToEnable = [];

  for (var campaignId in campaignData) {

    var currentCampaign = campaignData[campaignId];
    var BudgetId = currentCampaign.BudgetId;
    if (sharedBudgets[BudgetId] !== undefined) {
      Logger.log(sharedBudgets[BudgetId])
    }
    //Logger.log(sharedBudgetData[BudgetId])
    if (sharedBudgets[BudgetId]) {
      var budget = sharedBudgets[BudgetId].Amount;
      var spend = sharedBudgets[BudgetId].Cost;

    } else {
      var budget = currentCampaign.Budget;
      var spend = currentCampaign.Spend;
    }

    var status = currentCampaign.CampaignStatus;
    var label = currentCampaign.Labels;

    var pauseBudgetCap = pauseThreshold * budget;
    var labelBudgetCap = labelThreshold * budget;

    if (status == 'enabled' && label.indexOf('"' + labelName + '"') == -1) {
      if (spend >= labelBudgetCap) {
        campaignsToAddLabel.push(currentCampaign);
      }
    }
    if (status == 'enabled') {
      if (spend >= pauseBudgetCap) {
        campaignsToPause.push(currentCampaign);
      }
    }
    if (status == 'paused' && label.indexOf('"' + labelName + '"') != -1) {
      if (spend <= pauseBudgetCap) {
        campaignsToEnable.push(currentCampaign);
      }
    }
    if (status == 'enabled' && label.indexOf('"' + labelName + '"') != -1) {
      if (spend <= labelBudgetCap) {
        campaignsToRemoveLabel.push(currentCampaign);
      }
    }
  }

  //Изменяем и обновляем кампании
  if (campaignsToEnable.length > 0 && campaignPauser === true) {
    Logger.log(campaignsToEnable.length + " campaigns to enable");
    enableCampaigns(campaignsToEnable);
  }
  if (campaignsToRemoveLabel.length > 0) {
    Logger.log(campaignsToRemoveLabel.length + " campaigns to unlabel");
    removeLabel(campaignsToRemoveLabel);
  }
  if (campaignsToAddLabel.length > 0) {
    Logger.log(campaignsToAddLabel.length + " campaigns to label");
    addLabel(campaignsToAddLabel);
  }
  if (campaignsToPause.length > 0 && campaignPauser === true) {
    Logger.log(campaignsToPause.length + " campaigns to pause");
    pauseCampaigns(campaignsToPause);
  }

  // Отправляем email, если были какие-либо действия
  sendSummaryEmail(campaignsToAddLabel, campaignsToPause, campaignPauser, email);
}


// Проверка вводных данных
function checkInputs() {
  if (!isValidNumber(labelThreshold)) {
    throw "labelThreshold '" + labelThreshold + "' is not a valid, positive number.";
  }
  if (labelThreshold > 2) {
    Logger.log("Warning: labelThreshold '" + labelThreshold + "' is greater than 2. As AdWords does not spend more than twice the budget, this threshold will not be reached.");
  }
  if (campaignPauser) {
    if (!isValidNumber(pauseThreshold)) {
      throw "pauseThreshold '" + pauseThreshold + "' is not a valid, positive number.";
    }
    if (pauseThreshold < labelThreshold) {
      throw "pauseThreshold '" + pauseThreshold + "' is less than labelThreshold '" + labelThreshold + "'. It should be greater than or equal to labelThreshold.";
    }
    if (pauseThreshold > 2) {
      Logger.log("Warning: pauseThreshold '" + pauseThreshold + "' is greater than 2. As AdWords does not spend more than twice the budget, this threshold will not be reached.");
    }
  }

}


// Проверяет ввод числа, которое является конечным и больше нуля
function isValidNumber(number) {
  var isANumber = !isNaN(number) && isFinite(number);
  var isPositive = number > 0;
  return isANumber && isPositive;
}


// Получаем идентификаторы кампаний, которые соответсвуют настройкам скрипта
function getCampaignIds() {
  var whereStatement = "WHERE CampaignStatus IN ['ENABLED','PAUSED'] ";
  var whereStatementsArray = [];
  var campData = {};

  for (var i = 0; i < campaignNameDoesNotContain.length; i++) {
    whereStatement += "AND CampaignName DOES_NOT_CONTAIN_IGNORE_CASE '" + campaignNameDoesNotContain[i].replace(/"/g, '\\\"') + "' ";
  }

  if (campaignNameContains.length == 0) {
    whereStatementsArray = [whereStatement];
  } else {
    for (var i = 0; i < campaignNameContains.length; i++) {
      whereStatementsArray.push(whereStatement + 'AND CampaignName CONTAINS_IGNORE_CASE "' + campaignNameContains[i].replace(/"/g, '\\\"') + '" ');
    }
  }

  for (var i = 0; i < whereStatementsArray.length; i++) {
    var report = AdWordsApp.report(
      "SELECT CampaignId, CampaignName, CampaignStatus, Amount, Labels, LabelIds, Cost, BudgetId " +
      "FROM   CAMPAIGN_PERFORMANCE_REPORT " +
      whereStatementsArray[i] +
      "AND AdvertisingChannelType IN ['SEARCH', 'DISPLAY'] " +
      "DURING TODAY");

    var rows = report.rows();
    while (rows.hasNext()) {
      var row = rows.next();
      var budget = parseFloat(row['Amount'].replace(/,/g, ""));
      var spend = parseFloat(row['Cost'].replace(/,/g, ""));
      var campaignId = row['CampaignId'];

      campData[campaignId] = {
        CampaignId: campaignId,
        CampaignName: row['CampaignName'],
        CampaignStatus: row['CampaignStatus'],
        Spend: spend,
        Budget: budget,
        Labels: row['Labels'],
        LabelId: row['LabelIds'],
        BudgetId: row['BudgetId']
      };

    }
  }

  var campaignIds = Object.keys(campData);
  if (campaignIds.length == 0) {
    throw ("No campaigns found with the given settings.");
  }
  Logger.log(campaignIds.length + " campaigns found");

  return campData;
}


// Создаем ярлык, если его нет в аккаунте и возвращаем его ID.
// (Returns a dummy ID if the label does not exist and this is a preview run,
// because we can't create or apply the label)
function getOrCreateLabelId(labelName) {
  var labels = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get();

  if (!labels.hasNext()) {
    AdWordsApp.createLabel(labelName);
    labels = AdWordsApp.labels().withCondition("Name = '" + labelName + "'").get();
  }

  if (AdWordsApp.getExecutionInfo().isPreview() && !labels.hasNext()) {
    var labelId = 0;
  } else {
    var labelId = labels.next().getId();
  }
  return labelId;
}


//Останавливаем кампании
function pauseCampaigns(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaignIterator = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId)
      .get();
    if (campaignIterator.hasNext()) {
      var campaign = campaignIterator.next();
      campaign.pause();
      campaignData[j].CampaignStatus = 'paused';
    }
  }
}


//Возобновляем кампании, которые были остановлены
function enableCampaigns(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaignIterator = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId)
      .get();
    if (campaignIterator.hasNext()) {
      var campaign = campaignIterator.next();
      campaign.enable();
      campaignData[j].CampaignStatus = 'enabled';
    }
  }
}


//Добавляем ярлык к кампании
function addLabel(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaign = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId).get().next();
    getOrCreateLabelId(labelName);
    campaign.applyLabel(labelName);
  }
}


//Удаляем ярлык с кампании
function removeLabel(campaignData) {
  for (j = 0; j < campaignData.length; j++) {
    var campaign = AdWordsApp.campaigns()
      .withCondition('CampaignId = ' + campaignData[j].CampaignId).get().next();
    campaign.removeLabel(labelName);
  }
}


// Объединенная информация о помеченных и приостановленных кампаниях для отправки электронной почты
function sendSummaryEmail(campaignsToAddLabel, campaignsToPause, campaignPauser, email) {
  var localDate = Utilities.formatDate(new Date(), AdWordsApp.currentAccount().getTimeZone(), "yyyy-MM-dd");
  var localTime = Utilities.formatDate(new Date(), AdWordsApp.currentAccount().getTimeZone(), "HH:mm");

  // Собираем сообщение электронной почты
  var subject = AdWordsApp.currentAccount().getName() + " - Budget Overspend Email";
  var message = "";
  message += makeChangeMessage(campaignsToAddLabel, 'labelled');
  if (campaignPauser) {
    message += makeChangeMessage(campaignsToPause, 'paused');
  }
  if (message == "") {
    Logger.log("No message to send.");
    return;
  }
  message = localDate + " at " + localTime + " :" + message;
  MailApp.sendEmail({
    to: email.join(','),
    subject: subject,
    htmlBody: message
  });
  Logger.log("Message to " + email.join(',') + " sent.");
}


// Преобразуем данные о кампания в HTML таблицу
function makeChangeMessage(campaignData, changed) {
  if (campaignData.length == 0) {
    return "";
  }
  var message = "<br><br>Campaigns that have been " + changed + "<br><br>";
  var table = "<table border=1 style='border: 1px solid black; border-collapse: collapse;'>";
  table += "<tr><th>Campaign ID</th><th>Campaign Name</th><th>Status</th><th>Spend</th><th>Budget</th></tr>";
  for (var k = 0; k < campaignData.length; k++) {
    table += "<tr><td>" + campaignData[k].CampaignId + "</td><td>" + campaignData[k].CampaignName + "</td><td>" +
      campaignData[k].CampaignStatus + "</td><td>" + formatNumber(campaignData[k].Spend, true) + "</td><td>" + formatNumber(campaignData[k].Budget, true) + "</td>";
    table += "</tr>";
  }
  table += "</table>";
  message += table;
  return message;
}


// Форматирование чисел
function formatNumber(number, isCurrency) {
  if (isCurrency) {
    var formattedNumber = number.toFixed(2);
    formattedNumber = formattedNumber.substr(0, formattedNumber.length - 3);
    formattedNumber = formattedNumber.split('').reverse().join('').replace(/(...)/g, "$1 ").trim().split('').reverse().join('').replace(/ /g, thousandsSeparator);
    formattedNumber = currencySymbol + formattedNumber + decimalMark + number.toFixed(2).substr(-2);
  } else {
    var formattedNumber = number.toFixed(0).split('').reverse().join('').replace(/(...)/g, "$1 ").trim().split('').reverse().join('').replace(/ /g, thousandsSeparator);
  }
  return formattedNumber;
}

// Added function, which creates object of shared budget data
// Добавлена функция, которая создает объект для общих бюджетов

function sharedBudgetData() {
  var budgetsData = {};

  var report = AdWordsApp.report(
    'SELECT BudgetName, BudgetId, Amount, Cost ' +
    'FROM   BUDGET_PERFORMANCE_REPORT ' +
    'WHERE  IsBudgetExplicitlyShared = TRUE ' +
    'DURING TODAY');

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    var BudgetName = row['BudgetName'];
    var Cost = parseFloat(row['Cost'].replace(/,/g, ""));
    var Amount = parseFloat(row['Amount'].replace(/,/g, ""));
    var BudgetId = row['BudgetId'];
    addToMultiMap(budgetsData, BudgetId, [Amount, Cost, BudgetName])
  }

  return budgetsData;
}

//Вспомогательная функция

function addToMultiMap(map, key, value) {
  if (!map[key]) {
    map[key] = {
      Amount: value[0],
      Cost: 0,
      Name: value[2]
    };
  }
  map[key].Cost += value[1];
}
