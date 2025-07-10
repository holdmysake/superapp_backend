import { DataTypes } from 'sequelize'
import Spot from '../models/spot.model.js'
import moment from 'moment-timezone'
import sequelize from '../config/db.js'

const defineUserDataModel = (tableName) => {
    return sequelize.define(tableName, {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        spot_id: {
            type: DataTypes.STRING,
            allowNull: false,
            references: {
                model: Spot,
                key: 'spot_id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        },
        psi: {
            type: DataTypes.FLOAT
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            get() {
                const raw = this.getDataValue('timestamp')
                return raw ? moment(raw).format('YYYY-MM-DD HH:mm:ss') : null
            }
        }
    }, {
        tableName,
        timestamps: false
    })
}

export default defineUserDataModel
