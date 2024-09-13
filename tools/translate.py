#!/usr/bin/env python3

import translators as ts
import sys
import json
import os

def load_json(language='en'):
    file_path = f"localization/{language}.json"
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)['en']['translation']

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: translate.py <lang>")
        sys.exit(1)
    lang = sys.argv[1]
    if lang == "en":
        print("English is the default language")
        sys.exit(0)
    elif lang == "es":
        lang_name = "Spanish - Española"
    elif lang == "gl":
        lang_name = "Galician - Galego"
    elif lang == "fr":
        lang_name = "French - Français"
    elif lang == "iw":
        lang_name = "Hebrew - עִברִית"
    elif lang == "zh":
        lang_name = "Simplified Chinese - 简体中文"

    final_lang_key = lang

    if lang == 'iw':
        final_lang_key = 'he'

    output = {}
    output['title'] = lang_name
    output['rtl'] = "false"
    output[lang] = {}
    output[lang]['translation'] = {}

    translation = {}

    en = load_json()
    print(en)
    for k, v in en.items():
        translation[k] = ts.translate_text(v, from_language="en", to_language=final_lang_key)
        print("%s => %s\n" % (k, translation[k]))
    output[lang]["translation"] = translation

    with open(f"localization/{lang}.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=4, ensure_ascii=False)
