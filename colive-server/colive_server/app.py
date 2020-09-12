from flask import Flask

from . import conf

app = Flask(__package__)
app.config.from_object(conf)
