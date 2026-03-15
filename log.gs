function logHata(mesaj, hata) {
  Logger.log("HATA: " + mesaj + (hata ? " - " + hata.toString() : ""));
}

function logBilgi(mesaj) {
  Logger.log("BILGI: " + mesaj);
}
