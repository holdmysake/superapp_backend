import { DataTypes } from 'sequelize'
import sequelize from '../config/db.js'
import Spot from './spot.model.js'
import moment from 'moment-timezone'

const Battery = sequelize.define('battery', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    spot_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        references: {
            model: Spot,
            key: 'spot_id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    batt: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        get() {
            const raw = this.getDataValue('timestamp')
            return raw ? moment(raw).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss') : null
        }
    }
}, {
    tableName: 'battery',
    timestamps: false,
    underscored: true
})

export default Battery
